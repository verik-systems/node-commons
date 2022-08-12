/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

import { Logger } from "@nestjs/common"
import { format } from "@sqltools/formatter/lib/sqlFormatter"
import { camelCase } from "lodash"
import * as path from "path"
import { DataSource, DataSourceOptions, QueryRunner } from "typeorm"
import { PlatformTools } from "typeorm/platform/PlatformTools"
import * as yargs from "yargs"
import { CommandUtils } from "../CommandUtils"

/**
 * Drops all tables of the database from the given connection.
 */
export class SchemaDropCommand implements yargs.CommandModule {
  command = "schema:drop"
  describe =
    "Drops all tables in the database on your default dataSource. " +
    "To drop table of a concrete connection's database use -c option."

  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args.option("dataSource", {
      alias: "d",
      describe: "Path to the file where your DataSource instance is defined.",
      // demandOption: true,
    })
  }

  handler = async (_: yargs.Arguments) => {
    let dataSource: DataSource | undefined = undefined
    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })

      await dataSource.initialize()
      await dataSource.dropDatabase()
      await dataSource.destroy()

      Logger.log("Database schema has been successfully dropped.")
    } catch (err) {
      PlatformTools.logCmdErr("Error during schema drop:", err)

      if (dataSource && dataSource.isInitialized) await dataSource.destroy()

      process.exit(1)
    }
  }
}

/**
 * Executes an SQL query on the given connection.
 */
export class QueryCommand implements yargs.CommandModule {
  command = "query [query]"
  describe = `Executes given SQL query on a default dataSource. Specify connection name to run query on a specific dataSource.`
  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .positional("query", {
        describe: "The SQL Query to run",
        type: "string",
      })
      .option("dataSource", {
        alias: "d",
        describe: "Path to the file where your DataSource instance is defined.",
        // demandOption: true,
      })
  }

  handler = async (args: yargs.Arguments) => {
    let queryRunner: QueryRunner | undefined = undefined
    let dataSource: DataSource | undefined = undefined
    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      await dataSource.initialize()

      // create a query runner and execute query using it
      queryRunner = dataSource.createQueryRunner()
      const query = args.query as string

      Logger.log(`Running query: ${PlatformTools.highlightSql(query)}`)

      const queryResult = await queryRunner.query(query)

      if (typeof queryResult === "undefined") {
        Logger.log("Query has been executed. No result was returned.")
      } else {
        Logger.log("Query has been executed. Result: ")
        console.log(PlatformTools.highlightJson(JSON.stringify(queryResult, undefined, 2)))
      }

      await queryRunner.release()
      await dataSource.destroy()
    } catch (err) {
      PlatformTools.logCmdErr("Error during query execution:", err)

      if (queryRunner) await queryRunner.release()
      if (dataSource && dataSource.isInitialized) await dataSource.destroy()

      process.exit(1)
    }
  }
}

/**
 * Runs migration command.
 */
export class MigrationRunCommand implements yargs.CommandModule {
  command = "migration:run"
  describe = "Runs all pending migrations."
  aliases = "migration:run"
  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("dataSource", {
        alias: "d",
        describe: "Path to the file where your DataSource instance is defined.",
        // demandOption: true,
      })
      .option("transaction", {
        alias: "t",
        default: "default",
        describe: "Indicates if transaction should be used or not for migration run. Enabled by default.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    let dataSource: DataSource | undefined = undefined
    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      await dataSource.initialize()

      const options = {
        transaction: dataSource.options.migrationsTransactionMode ?? ("all" as "all" | "none" | "each"),
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

      await dataSource.runMigrations(options)
      await dataSource.destroy()

      // exit process if no errors
      process.exit(0)
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration run:", err)

      if (dataSource && dataSource.isInitialized) await dataSource.destroy()

      process.exit(1)
    }
  }
}

/**
 * Runs migration command.
 */
export class MigrationShowCommand implements yargs.CommandModule {
  command = "migration:show"
  describe = "Show all migrations and whether they have been run or not"
  dataSourceOptions: DataSourceOptions
  aliases?: string | readonly string[]

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args.option("dataSource", {
      alias: "d",
      describe: "Path to the file where your DataSource instance is defined.",
      // demandOption: true,
    })
  }

  handler = async (_: yargs.Arguments) => {
    let dataSource: DataSource | undefined = undefined
    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      await dataSource.initialize()
      await dataSource.showMigrations()
      await dataSource.destroy()

      process.exit(0)
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration show:", err)

      if (dataSource && dataSource.isInitialized) await dataSource.destroy()

      process.exit(1)
    }
  }
}

/**
 * Reverts last migration command.
 */
export class MigrationRevertCommand implements yargs.CommandModule {
  command = "migration:revert"
  describe = "Reverts last executed migration."
  aliases = "migration:revert"
  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("dataSource", {
        alias: "d",
        describe: "Path to the file where your DataSource instance is defined.",
        // demandOption: true,
      })
      .option("transaction", {
        alias: "t",
        default: "default",
        describe: "Indicates if transaction should be used or not for migration revert. Enabled by default.",
      })
  }

  handler = async (args: yargs.Arguments) => {
    let dataSource: DataSource | undefined = undefined

    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        subscribers: [],
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      await dataSource.initialize()

      const options = {
        transaction: dataSource.options.migrationsTransactionMode ?? ("all" as "all" | "none" | "each"),
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

      await dataSource.undoLastMigration(options)
      await dataSource.destroy()
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration revert:", err)

      if (dataSource && dataSource.isInitialized) await dataSource.destroy()

      process.exit(1)
    }
  }
}

/**
 * Creates a new migration file.
 */
export class MigrationCreateCommand implements yargs.CommandModule {
  command = "migration:create <path>"
  describe = "Creates a new migration file."
  aliases = "migration:create"

  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = (args: yargs.Argv) => {
    return args
      .option("o", {
        alias: "outputJs",
        type: "boolean",
        default: false,
        describe: "Generate a migration file on Javascript instead of Typescript",
      })
      .option("t", {
        alias: "timestamp",
        type: "number",
        default: false,
        describe: "Custom timestamp for the migration name",
      })
  }

  handler = async (args: yargs.Arguments) => {
    try {
      const timestamp = CommandUtils.getTimestamp(args.timestamp)

      const inputPath = (args.path as string).startsWith("/")
        ? (args.path as string)
        : path.resolve(process.cwd(), args.path as string)
      const filename = path.basename(inputPath)
      const fullPath = path.dirname(inputPath) + "/" + timestamp + "-" + filename

      const fileContent = args.outputJs
        ? MigrationCreateCommand.getJavascriptTemplate(filename, timestamp)
        : MigrationCreateCommand.getTemplate(filename, timestamp)

      await CommandUtils.createFile(fullPath + (args.outputJs ? ".js" : ".ts"), fileContent)

      Logger.log(`Migration ${fullPath + (args.outputJs ? ".js" : ".ts")} has been generated successfully.`)
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration creation:", err)
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
  command = "migration:generate <path>"
  describe = "Generates a new migration file with sql needs to be executed to update schema."
  aliases = "migrations:generate"

  dataSourceOptions: DataSourceOptions

  constructor(dataSourceOptions: DataSourceOptions) {
    this.dataSourceOptions = dataSourceOptions
  }

  builder = async (args: yargs.Argv) => {
    return args
      .option("dataSource", {
        alias: "d",
        type: "string",
        describe: "Path to the file where your DataSource instance is defined.",
        // demandOption: true,
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
      .option("t", {
        alias: "timestamp",
        type: "number",
        default: false,
        describe: "Custom timestamp for the migration name",
      })
  }

  handler = async (args: yargs.Arguments) => {
    const timestamp = CommandUtils.getTimestamp(args.timestamp)
    const extension = args.outputJs ? ".js" : ".ts"
    const fullPath = (args.path as string).startsWith("/")
      ? (args.path as string)
      : path.resolve(process.cwd(), args.path as string)
    const filename = timestamp + "-" + path.basename(fullPath) + extension

    let dataSource: DataSource | undefined = undefined

    try {
      dataSource = new DataSource(this.dataSourceOptions)
      dataSource.setOptions({
        synchronize: false,
        migrationsRun: false,
        dropSchema: false,
      })
      await dataSource.initialize()

      const upSqls: string[] = [],
        downSqls: string[] = []

      try {
        const sqlInMemory = await dataSource.driver.createSchemaBuilder().log()

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
        await dataSource.destroy()
      }

      if (!upSqls.length) {
        if (args.check) {
          Logger.log(`No changes in database schema were found`)
          process.exit(0)
        } else {
          Logger.warn(
            `No changes in database schema were found - cannot generate a migration. To create a new empty migration use "typeorm migration:create" command`,
          )
          process.exit(1)
        }
      } else if (!args.path) {
        Logger.warn("Please specify a migration path")
        process.exit(1)
      }

      const fileContent = args.outputJs
        ? MigrationGenerateCommand.getJavascriptTemplate(path.basename(fullPath), timestamp, upSqls, downSqls.reverse())
        : MigrationGenerateCommand.getTemplate(path.basename(fullPath), timestamp, upSqls, downSqls.reverse())

      if (args.check) {
        Logger.warn(`Unexpected changes in database schema were found in check mode:\n\n`, fileContent)
        process.exit(1)
      }

      if (args.dryrun) {
        Logger.log(`Migration ${fullPath + extension} has content:\n\n`, fileContent)
      } else {
        const migrationFileName = path.dirname(fullPath) + "/" + filename
        await CommandUtils.createFile(migrationFileName, fileContent)

        Logger.log(`Migration ${migrationFileName} has been generated successfully.`)
      }
    } catch (err) {
      PlatformTools.logCmdErr("Error during migration generation:", err)
      process.exit(1)
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
