/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { Injectable } from "@nestjs/common"
import { DataSourceOptions } from "typeorm"
import * as yargs from "yargs"
import {
  MigrationCreateCommand,
  MigrationGenerateCommand,
  MigrationRevertCommand,
  MigrationRunCommand,
  MigrationShowCommand,
  QueryCommand,
  SchemaDropCommand,
} from "./migrator.command"

@Injectable()
export class MigratorService {
  async start(dataSourceOptions: DataSourceOptions) {
    const migrationQuery = new QueryCommand(dataSourceOptions)
    const migrationShow = new MigrationShowCommand(dataSourceOptions)
    const migrationRun = new MigrationRunCommand(dataSourceOptions)
    const migrationRevert = new MigrationRevertCommand(dataSourceOptions)
    const migrationDrop = new SchemaDropCommand(dataSourceOptions)
    const migrationCreate = new MigrationCreateCommand(dataSourceOptions)
    const migrationGenerate = new MigrationGenerateCommand(dataSourceOptions)

    const commands = [
      migrationQuery,
      migrationShow,
      migrationRun,
      migrationRevert,
      migrationDrop,
      migrationCreate,
      migrationGenerate,
    ]

    const existingCommand = commands.find((c) => c.command === process.argv[2])

    if (existingCommand) {
      return yargs
        .usage("Usage: $0 <command> [options]")
        .command(existingCommand.command, existingCommand.describe, existingCommand.builder, existingCommand.handler)
        .recommendCommands()
        .strict()
        .alias("v", "version")
        .help("h")
        .alias("h", "help").argv
    }

    // show hint helper all commands
    return commands.reduce((builder, cmd: yargs.CommandModule, index) => {
      const newBuilder = builder.command(cmd)
      if (commands.length - 1 === index) {
        newBuilder.recommendCommands().demandCommand(1).strict().alias("v", "version").help("h").alias("h", "help").argv
      }
      return newBuilder
    }, yargs.usage("Usage: $0 <command> [options]"))
  }
}
