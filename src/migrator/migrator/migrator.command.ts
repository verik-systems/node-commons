/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Logger } from "@nestjs/common"
import { format } from "@sqltools/formatter/lib/sqlFormatter"
import { camelCase } from "lodash"
import { Connection, ConnectionOptions, createConnection, QueryRunner } from "typeorm"
import { PlatformTools } from "typeorm/platform/PlatformTools"
import * as yargs from "yargs"
import { CommandUtils } from "../CommandUtils"

/**
 * Drops all tables of the database from the given connection.
 */
export class SchemaDropCommand implements yargs.CommandModule {
  command = "schema:drop"
  describe =
    "Drops all tables in the database on your default connection. " +
    "To drop table of a concrete connection's database use -c option."

  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
  }

  builder = (args: yargs.Argv) => {
    return args.option("c", {
      alias: "connection",
      default: "default",
      describe: "Name of the connection on which to drop all tables.",
    })
  }

  handler = async () => {
    let connection: Connection | undefined = undefined
    try {
      Object.assign(this.connectionOptions, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      connection = await createConnection(this.connectionOptions)
      await connection.dropDatabase()
      await connection.close()

      Logger.log("Database schema has been successfully dropped.")
    } catch (err) {
      if (connection) await connection.close()
      Logger.error("Error during schema drop:")
      console.error(err)
    }
  }
}

/**
 * Executes an SQL query on the given connection.
 */
export class QueryCommand implements yargs.CommandModule {
  command = "query [query]"
  describe = `Executes given SQL query on a default connection.
      Specify connection name to run query on a specific connection.`
  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .positional("query", {
        describe: "The SQL Query to run",
        type: "string",
      })
      .option("c", {
        alias: "connection",
        default: "default",
        describe: "Name of the connection on which to run a query.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    let connection: Connection | undefined = undefined
    let queryRunner: QueryRunner | undefined = undefined
    try {
      Object.assign(this.connectionOptions, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      connection = await createConnection(this.connectionOptions)
      // create a query runner and execute query using it
      queryRunner = connection.createQueryRunner()
      const query = args.query as string

      Logger.log("Running query: " + PlatformTools.highlightSql(query))

      const queryResult = await queryRunner.query(query)

      if (typeof queryResult === "undefined") {
        Logger.log("Query has been executed. No result was returned.")
      } else {
        Logger.log("Query has been executed. Result: ")
        console.log(PlatformTools.highlightJson(JSON.stringify(queryResult, undefined, 2)))
      }

      await queryRunner.release()
      await connection.close()
    } catch (err) {
      if (queryRunner) await queryRunner.release()
      if (connection) await connection.close()
      Logger.error("Error during query execution:")
      console.error(err)
    }
  }
}

/**
 * Runs migration command.
 */
export class MigrationRunCommand implements yargs.CommandModule {
  command = "migration:run"
  describe = "Runs all pending migrations."
  aliases = "migrations:run"
  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
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
        describe: "Indicates if transaction should be used or not for migration run. Enabled by default.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    let connection: Connection | undefined = undefined
    try {
      Object.assign(this.connectionOptions, {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
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

      await connection.runMigrations(options)
      await connection.close()
    } catch (err) {
      if (connection) await connection.close()
      Logger.error("Error during migration run:")
      console.error(err)
    }
  }
}

/**
 * Runs migration command.
 */
export class MigrationShowCommand implements yargs.CommandModule {
  command = "migration:show"
  describe = "Show all migrations and whether they have been run or not"
  connectionOptions: ConnectionOptions
  aliases?: string | readonly string[]
  deprecated?: string | boolean

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
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
      Object.assign(this.connectionOptions, {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      connection = await createConnection(this.connectionOptions)
      const unappliedMigrations = await connection.showMigrations()
      await connection.close()
      Logger.log(`Unapplied migrations: ${unappliedMigrations}`)
    } catch (err) {
      if (connection) await connection.close()
      Logger.error("Error during migration show:")
      console.error(err)
    }
  }
}

/**
 * Reverts last migration command.
 */
export class MigrationRevertCommand implements yargs.CommandModule {
  command = "migration:revert"
  describe = "Reverts last executed migration."
  aliases = "migrations:revert"
  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("c", {
        alias: "connection",
        default: "default",
        describe: "Name of the connection on which run a query.",
      })
      .option("transaction", {
        alias: "t",
        default: "default",
        describe: "Indicates if transaction should be used or not for migration revert. Enabled by default.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    if (args._[0] === "migrations:revert") {
      console.log("'migrations:revert' is deprecated, please use 'migration:revert' instead")
    }

    let connection: Connection | undefined = undefined
    try {
      Object.assign(this.connectionOptions, {
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
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

      await connection.undoLastMigration(options)
      await connection.close()
    } catch (err) {
      if (connection) await connection.close()

      Logger.error("Error during migration revert:")
      console.error(err)
    }
  }
}

/**
 * Creates a new migration file.
 */
export class MigrationCreateCommand implements yargs.CommandModule {
  command = "migration:create"
  describe = "Creates a new migration file."
  aliases = "migrations:create"
  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
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
        describe: "Name of the migration class.",
        demand: true,
      })
      .option("d", {
        alias: "dir",
        describe: "Directory where migration should be created.",
      })
      .option("o", {
        alias: "outputJs",
        type: "boolean",
        default: false,
        describe: "Generate a migration file on Javascript instead of Typescript",
      })
  }

  handler = async (args: yargs.Arguments) => {
    try {
      const timestamp = new Date().getTime()
      const fileContent = args.outputJs
        ? MigrationCreateCommand.getJavascriptTemplate(args.name as any, timestamp)
        : MigrationCreateCommand.getTemplate(args.name as any, timestamp)
      const extension = args.outputJs ? ".js" : ".ts"
      const filename = timestamp + "-" + args.name + extension
      let directory = args.dir as string | undefined

      // if directory is not set then try to open tsconfig and find default path there
      if (!directory) {
        directory = this.connectionOptions.cli ? this.connectionOptions.cli.migrationsDir || "" : ""
      }

      if (directory && !directory.startsWith("/")) {
        directory = process.cwd() + "/" + directory
      }
      const path = (directory ? directory + "/" : "") + filename
      await CommandUtils.createFile(path, fileContent)
      Logger.log(`Migration has been generated successfully.`)
    } catch (err) {
      Logger.error("Error during migration creation:")
      console.error(err)
    }
  }

  // -------------------------------------------------------------------------
  // Protected Static Methods
  // -------------------------------------------------------------------------

  /**
   * Gets contents of the migration file.
   */
  protected static getTemplate(name: string, timestamp: number): string {
    return `import { MigrationInterface, QueryRunner } from 'typeorm'

export class ${camelCase(name)}${timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {

  }
  public async down(queryRunner: QueryRunner): Promise<void> {

  }
}`
  }

  /**
   * Gets contents of the migration file in Javascript.
   */
  protected static getJavascriptTemplate(name: string, timestamp: number): string {
    return `const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class ${camelCase(name)}${timestamp} {
  async up(queryRunner) {

  }
  async down(queryRunner) {

  }
}`
  }
}

/**
 * Generates a new migration file with sql needs to be executed to update schema.
 */
export class MigrationGenerateCommand implements yargs.CommandModule {
  command = "migration:generate"
  describe = "Generates a new migration file with sql needs to be executed to update schema."
  aliases = "migrations:generate"
  connectionOptions: ConnectionOptions

  constructor(connectionOptions: ConnectionOptions) {
    this.connectionOptions = connectionOptions
  }

  builder = async (args: yargs.Argv) => {
    return args
      .option("c", {
        alias: "connection",
        default: "default",
        describe: "Name of the connection on which run a query.",
      })
      .option("n", {
        alias: "name",
        describe: "Name of the migration class.",
        demand: true,
        type: "string",
      })
      .option("d", {
        alias: "dir",
        describe: "Directory where migration should be created.",
      })
      .option("p", {
        alias: "pretty",
        type: "boolean",
        default: false,
        describe: "Pretty-print generated SQL",
      })
      .option("o", {
        alias: "outputJs",
        type: "boolean",
        default: false,
        describe: "Generate a migration file on Javascript instead of Typescript",
      })
      .option("dr", {
        alias: "dryrun",
        type: "boolean",
        default: false,
        describe: "Prints out the contents of the migration instead of writing it to a file",
      })
      .option("ch", {
        alias: "check",
        type: "boolean",
        default: false,
        describe:
          "Verifies that the current database is up to date and that no migrations are needed. Otherwise exits with code 1.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    if (args._[0] === "migrations:generate") {
      console.log("'migrations:generate' is deprecated, please use 'migration:generate' instead")
    }

    const timestamp = new Date().getTime()
    const extension = args.outputJs ? ".js" : ".ts"
    const filename = timestamp + "-" + args.name + extension
    let directory = args.dir as string | undefined

    // if directory is not set then try to open tsconfig and find default path there
    if (!directory) {
      directory = this.connectionOptions.cli ? this.connectionOptions.cli.migrationsDir || "" : ""
    }

    try {
      Object.assign(this.connectionOptions, {
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })

      const upSqls: string[] = [],
        downSqls: string[] = []

      const connection = await createConnection(this.connectionOptions)
      try {
        const sqlInMemory = await connection.driver.createSchemaBuilder().log()

        if (args.pretty) {
          sqlInMemory.upQueries.forEach((upQuery) => {
            upQuery.query = MigrationGenerateCommand.prettifyQuery(upQuery.query)
          })
          sqlInMemory.downQueries.forEach((downQuery) => {
            downQuery.query = MigrationGenerateCommand.prettifyQuery(downQuery.query)
          })
        }

        sqlInMemory.upQueries.forEach((upQuery) => {
          upSqls.push(
            "        await queryRunner.query(`" +
              upQuery.query.replace(new RegExp("`", "g"), "\\`") +
              "`" +
              MigrationGenerateCommand.queryParams(upQuery.parameters) +
              ");",
          )
        })
        sqlInMemory.downQueries.forEach((downQuery) => {
          downSqls.push(
            "        await queryRunner.query(`" +
              downQuery.query.replace(new RegExp("`", "g"), "\\`") +
              "`" +
              MigrationGenerateCommand.queryParams(downQuery.parameters) +
              ");",
          )
        })
      } finally {
        await connection.close()
      }

      if (!upSqls.length) {
        if (args.check) {
          Logger.warn(`No changes in database schema were found`)
          return
        } else {
          Logger.warn(
            `No changes in database schema were found - cannot generate a migration. To create a new empty migration use "typeorm migration:create" command`,
          )
          return
        }
      } else if (!args.name) {
        Logger.warn("Please specify a migration name using the `-n` argument")
        return
      }

      const fileContent = args.outputJs
        ? MigrationGenerateCommand.getJavascriptTemplate(args.name as any, timestamp, upSqls, downSqls.reverse())
        : MigrationGenerateCommand.getTemplate(args.name as any, timestamp, upSqls, downSqls.reverse())
      if (directory && !directory.startsWith("/")) {
        directory = process.cwd() + "/" + directory
      }
      const path = (directory ? directory + "/" : "") + filename

      if (args.check) {
        Logger.warn(`Unexpected changes in database schema were found in check mode:\n\n${fileContent}`)
        return
      }

      if (args.dryrun) {
        console.info(`Migration has content:\n\n${fileContent}`)
      } else {
        await CommandUtils.createFile(path, fileContent)

        Logger.log(`Migration has been generated successfully.`)
      }
    } catch (err) {
      Logger.error("Error during migration generation:")
      console.error(err)
      return
    }
  }

  // -------------------------------------------------------------------------
  // Protected Static Methods
  // -------------------------------------------------------------------------

  /**
   * Formats query parameters for migration queries if parameters actually exist
   */
  protected static queryParams(parameters: any[] | undefined): string {
    if (!parameters || !parameters.length) {
      return ""
    }

    return `, ${JSON.stringify(parameters)}`
  }

  /**
   * Gets contents of the migration file.
   */
  protected static getTemplate(name: string, timestamp: number, upSqls: string[], downSqls: string[]): string {
    const migrationName = `${camelCase(name)}${timestamp}`

    return `import { MigrationInterface, QueryRunner } from "typeorm";

export class ${migrationName} implements MigrationInterface {
  name = '${migrationName}'

  public async up(queryRunner: QueryRunner): Promise<void> {
${upSqls.join(`
`)}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
${downSqls.join(`
`)}
  }

}`
  }

  /**
   * Gets contents of the migration file in Javascript.
   */
  protected static getJavascriptTemplate(
    name: string,
    timestamp: number,
    upSqls: string[],
    downSqls: string[],
  ): string {
    const migrationName = `${camelCase(name)}${timestamp}`

    return `const { MigrationInterface, QueryRunner } = require("typeorm");

      module.exports = class ${migrationName} {
        name = '${migrationName}'

        async up(queryRunner) {
      ${upSqls.join(`
      `)}
        }

        async down(queryRunner) {
      ${downSqls.join(`
      `)}
        }
      }
    `
  }

  /**
   *
   */
  protected static prettifyQuery(query: string) {
    const formattedQuery = format(query, { indent: "    " })
    return "\n" + formattedQuery.replace(/^/gm, "            ") + "\n        "
  }
}
