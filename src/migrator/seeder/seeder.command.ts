/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Logger } from "@nestjs/common"
import { camelCase } from "lodash"
import { Connection, ConnectionOptions, createConnection } from "typeorm"
import * as yargs from "yargs"
import { CommandUtils } from "../CommandUtils"
import { SeedExecutor } from "./seeder.executor"
import { SeedInterface } from "./seeder.types"

/**
 * Runs seed show command.
 */
export class SeedShowCommand implements yargs.CommandModule {
  command = "seed:show"
  describe = "Show all seeds and whether they have been run or not"
  connectionOptions: ConnectionOptions
  aliases?: string | readonly string[]
  options: {
    dir?: string
    seeds: SeedInterface[]
    packageVersion: string
  }

  constructor(
    connectionOptions: ConnectionOptions,
    options: {
      dir?: string
      seeds: SeedInterface[]
      packageVersion: string
    },
  ) {
    this.connectionOptions = connectionOptions
    this.options = options
  }

  builder = (args: yargs.Argv) => {
    return args.option("connection", {
      alias: "c",
      default: "default",
      describe: "Name of the connection on which run a query.",
    })
  }

  handler = async () => {
    let connection: Connection | undefined = undefined

    try {
      connection = await createConnection(this.connectionOptions)
      const seedExecutor = new SeedExecutor(connection)

      const unappliedSeeds = await seedExecutor.showSeeds(this.options.seeds)
      await connection.close()
      Logger.log(`Unapplied seeds: ${unappliedSeeds}`)
    } catch (err) {
      if (connection) await connection.close()
      Logger.error("Error during seed show:")
      console.error(err)
    }
  }
}

/**
 * Runs seed command.
 */
export class SeedRunCommand implements yargs.CommandModule {
  command = "seed:run"
  describe = "Runs all pending seeds."
  aliases = "seed:run"
  connectionOptions: ConnectionOptions
  options: {
    dir?: string
    seeds: SeedInterface[]
    packageVersion: string
  }

  constructor(
    connectionOptions: ConnectionOptions,
    options: {
      dir?: string
      seeds: SeedInterface[]
      packageVersion: string
    },
  ) {
    this.connectionOptions = connectionOptions
    this.options = options
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("connection", {
        alias: "c",
        default: "default",
        describe: "Name of the connection on which run a query.",
      })
      .option("transaction", {
        alias: "t",
        default: "default",
        describe: "Indicates if transaction should be used or not for seed run. Enabled by default.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    let connection: Connection | undefined = undefined
    try {
      connection = await createConnection(this.connectionOptions)

      const options = {
        transaction: this.connectionOptions.migrationsTransactionMode ?? ("all" as "all" | "none" | "each"),
      }

      switch (args.t) {
        case "all":
          options.transaction = "all"
          break
        case "none":
        case "false":
          options.transaction = "none"
          break
        case "each":
          options.transaction = "each"
          break
        default:
        // noop
      }

      const seedExecutor = new SeedExecutor(connection)

      seedExecutor.transaction = (options && options.transaction) || "all"

      const successSeeds = await seedExecutor.executePendingSeeds(this.options.seeds, this.options.packageVersion)
      Logger.log(`Success Seeds: ${successSeeds.length}`)
      await connection.close()
    } catch (err) {
      if (connection) await connection.close()
      Logger.error("Error during migration run:")
      console.error(err)
    }
  }
}

/**
 * Creates a new seed file.
 */
export class SeedCreateCommand implements yargs.CommandModule {
  command = "seed:create"
  describe = "Creates a new seed file."
  aliases = "seed:create"
  connectionOptions: ConnectionOptions
  options: {
    dir?: string
    seeds: SeedInterface[]
    packageVersion: string
  }

  constructor(
    connectionOptions: ConnectionOptions,
    options: {
      dir?: string
      seeds: SeedInterface[]
      packageVersion: string
    },
  ) {
    this.connectionOptions = connectionOptions
    this.options = options
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("c", {
        alias: "connection",
        default: "default",
        describe: "Name of the connection on which run a query.",
      })
      .option("n", {
        alias: "name",
        describe: "Name of the seed class.",
        demand: true,
      })
      .option("d", {
        alias: "dir",
        describe: "Directory where seed should be created.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    try {
      const timestamp = new Date().getTime()
      const fileContent = SeedCreateCommand.getTemplate(args.name as any, timestamp)
      const extension = ".ts"
      const filename = timestamp + "-" + args.name + extension
      let directory = (args.dir as string) || this.options.dir

      if (directory && !directory.startsWith("/")) {
        directory = process.cwd() + "/" + directory
      }
      const path = (directory ? directory + "/" : "") + filename
      await CommandUtils.createFile(path, fileContent)
      Logger.log(`Seed has been generated successfully.`)
    } catch (err) {
      Logger.error("Error during seed creation:")
      console.error(err)
    }
  }

  // -------------------------------------------------------------------------
  // Protected Static Methods
  // -------------------------------------------------------------------------

  /**
   * Gets contents of the seed file.
   */
  protected static getTemplate(name: string, timestamp: number): string {
    return `import { QueryRunner } from 'typeorm'
import { SeedInterface } from '../seeder/seed-executor'

export class ${camelCase(name)}${timestamp} implements SeedInterface {
  name = '${camelCase(name)}${timestamp}'

  /**
   * all is not saved file seed in table seed and always run this file
   * none (not specific version) is check file in table ? if not exist then run this file else nothing todo
   * value (specific version) !== all and value !== none if (current package version === value) => run this file
  */

  version = 'none'

  public async up(queryRunner: QueryRunner): Promise<void> {

  }
}`
  }
}
