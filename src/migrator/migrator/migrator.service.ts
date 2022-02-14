/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */

import { Injectable } from "@nestjs/common"
import { ConnectionOptions } from "typeorm"
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
  async start(connectionOptions: ConnectionOptions) {
    const migrationQuery = new QueryCommand(connectionOptions)
    const migrationShow = new MigrationShowCommand(connectionOptions)
    const migrationRun = new MigrationRunCommand(connectionOptions)
    const migrationRevert = new MigrationRevertCommand(connectionOptions)
    const migrationDrop = new SchemaDropCommand(connectionOptions)
    const migrationCreate = new MigrationCreateCommand(connectionOptions)
    const migrationGenerate = new MigrationGenerateCommand(connectionOptions)

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
