/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-implied-eval */
/* eslint-disable @typescript-eslint/require-await */

import * as fs from "fs"
import * as mkdirp from "mkdirp"
import * as path from "path"
import { DataSource, InstanceChecker, TypeORMError } from "typeorm"
import { pathToFileURL } from "url"

/**
 * Command line utils functions.
 */
export class CommandUtils {
  /**
   * Creates directories recursively.
   */
  static createDirectories(directory: string) {
    return mkdirp(directory)
  }

  /**
   * Creates a file with the given content in the given path.
   */
  static async createFile(filePath: string, content: string, override = true): Promise<void> {
    await CommandUtils.createDirectories(path.dirname(filePath))
    return new Promise<void>((ok, fail) => {
      if (override === false && fs.existsSync(filePath)) return ok()

      fs.writeFile(filePath, content, (err) => (err ? fail(err) : ok()))
    })
  }

  /**
   * Reads everything from a given file and returns its content as a string.
   */
  static async readFile(filePath: string): Promise<string> {
    return new Promise<string>((ok, fail) => {
      fs.readFile(filePath, (err, data) => (err ? fail(err) : ok(data.toString())))
    })
  }

  static fileExists(filePath: string) {
    return fs.existsSync(filePath)
  }

  /**
   * Gets migration timestamp and validates argument (if sent)
   */
  static getTimestamp(timestampOptionArgument: any): number {
    if (timestampOptionArgument && (isNaN(timestampOptionArgument) || timestampOptionArgument < 0)) {
      throw new TypeORMError(`timestamp option should be a non-negative number. received: ${timestampOptionArgument}`)
    }
    return timestampOptionArgument ? new Date(Number(timestampOptionArgument)).getTime() : Date.now()
  }

  static async loadDataSource(dataSourceFilePath: string): Promise<DataSource> {
    let dataSourceFileExports
    try {
      ;[dataSourceFileExports] = await importOrRequireFile(dataSourceFilePath)
    } catch (err) {
      console.log(err)
      throw new Error(`Unable to open file: "${dataSourceFilePath}"`)
    }

    if (!dataSourceFileExports || typeof dataSourceFileExports !== "object") {
      throw new Error(`Given data source file must contain export of a DataSource instance`)
    }

    const dataSourceExports = []
    for (const fileExport in dataSourceFileExports) {
      if (InstanceChecker.isDataSource(dataSourceFileExports[fileExport])) {
        dataSourceExports.push(dataSourceFileExports[fileExport])
      }
    }

    if (dataSourceExports.length === 0) {
      throw new Error(`Given data source file must contain export of a DataSource instance`)
    }
    if (dataSourceExports.length > 1) {
      throw new Error(`Given data source file must contain only one export of DataSource instance`)
    }
    return dataSourceExports[0]
  }
}

export async function importOrRequireFile(filePath: string): Promise<[result: any, moduleType: "esm" | "commonjs"]> {
  const tryToImport = async (): Promise<[any, "esm"]> => {
    // `Function` is required to make sure the `import` statement wil stay `import` after
    // transpilation and won't be converted to `require`
    return [
      await Function("return filePath => import(filePath)")()(
        filePath.startsWith("file://") ? filePath : pathToFileURL(filePath).toString(),
      ),
      "esm",
    ]
  }
  const tryToRequire = async (): Promise<[any, "commonjs"]> => {
    return [require(filePath), "commonjs"]
  }

  const extension = filePath.substring(filePath.lastIndexOf(".") + ".".length)

  if (extension === "mjs" || extension === "mts") return tryToImport()
  else if (extension === "cjs" || extension === "cts") return tryToRequire()
  else if (extension === "js" || extension === "ts") {
    const packageJson = await getNearestPackageJson(filePath)

    if (packageJson != null) {
      const isModule = (packageJson as any)?.type === "module"

      if (isModule) return tryToImport()
      else return tryToRequire()
    } else return tryToRequire()
  }

  return tryToRequire()
}

function getNearestPackageJson(filePath: string): Promise<object | null> {
  return new Promise((accept) => {
    let currentPath = filePath

    function searchPackageJson() {
      const nextPath = path.dirname(currentPath)

      if (currentPath === nextPath)
        // the top of the file tree is reached
        accept(null)
      else {
        currentPath = nextPath
        const potentialPackageJson = path.join(currentPath, "package.json")

        fs.stat(potentialPackageJson, (err, stats) => {
          if (err != null) searchPackageJson()
          else if (stats.isFile()) {
            fs.readFile(potentialPackageJson, "utf8", (err, data) => {
              if (err != null) accept(null)
              else {
                try {
                  accept(JSON.parse(data))
                } catch (err) {
                  accept(null)
                }
              }
            })
          } else searchPackageJson()
        })
      }
    }

    searchPackageJson()
  })
}
