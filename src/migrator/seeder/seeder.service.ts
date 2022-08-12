/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable, Logger } from "@nestjs/common"
import * as glob from "glob"
import { DataSourceOptions, EntitySchema, getFromContainer } from "typeorm"
import { PlatformTools } from "typeorm/platform/PlatformTools"
import * as yargs from "yargs"
import { SeedCreateCommand, SeedRunCommand, SeedShowCommand } from "./seeder.command"
import { SeederExtraOptions, SeedInterface } from "./seeder.types"

@Injectable()
export class SeederService {
  async start(dataSourceOptions: DataSourceOptions, extraOptions: SeederExtraOptions) {
    const seedShowCommand = new SeedShowCommand(dataSourceOptions, extraOptions)
    const seedRunCommand = new SeedRunCommand(dataSourceOptions, extraOptions)
    const seedCreateCommand = new SeedCreateCommand(dataSourceOptions, extraOptions)

    const commands = [seedShowCommand, seedRunCommand, seedCreateCommand]

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

  static splitClassesAndStrings<T>(clsesAndStrings: (string | T)[]): [T[], string[]] {
    return [
      clsesAndStrings.filter((cls): cls is T => typeof cls !== "string"),
      clsesAndStrings.filter((str): str is string => typeof str === "string"),
    ]
  }

  /* eslint-disable @typescript-eslint/ban-types */
  static importClassesFromDirectories(directories: string[], formats = [".js", ".cjs", ".ts"]): Function[] {
    const logLevel = "info"
    const classesNotFoundMessage = "No classes were found using the provided glob pattern: "
    const classesFoundMessage = "All classes found using provided glob pattern"

    /* eslint-disable @typescript-eslint/ban-types */
    function loadFileClasses(exported: any, allLoaded: Function[]) {
      if (typeof exported === "function" || exported instanceof EntitySchema) {
        allLoaded.push(exported)
      } else if (Array.isArray(exported)) {
        exported.forEach((i: any) => loadFileClasses(i, allLoaded))
      } else if (typeof exported === "object" && exported !== null) {
        Object.keys(exported).forEach((key) => loadFileClasses(exported[key], allLoaded))
      }
      return allLoaded
    }

    const allFiles = directories.reduce((allDirs, dir) => {
      return allDirs.concat(glob.sync(PlatformTools.pathNormalize(dir)))
    }, [] as string[])

    if (directories.length > 0 && allFiles.length === 0) {
      Logger.debug(logLevel, `${classesNotFoundMessage} "${directories}"`)
    } else if (allFiles.length > 0) {
      Logger.debug(logLevel, `${classesFoundMessage} "${directories}" : "${allFiles}"`)
    }
    const dirs = allFiles
      .filter((file) => {
        const dtsExtension = file.substring(file.length - 5, file.length)
        return formats.indexOf(PlatformTools.pathExtname(file)) !== -1 && dtsExtension !== ".d.ts"
      })
      .map((file) => require(PlatformTools.pathResolve(file)))

    return loadFileClasses(dirs, [])
  }

  /* eslint-disable @typescript-eslint/ban-types */
  public static buildSeeds(seeds: (Function | string)[]): SeedInterface[] {
    const [seedClasses, seedDirectories] = SeederService.splitClassesAndStrings(seeds)
    const allSeedClasses = [...seedClasses, ...SeederService.importClassesFromDirectories(seedDirectories)]
    return allSeedClasses.map((seedClass) => getFromContainer<SeedInterface>(seedClass))
  }
}
