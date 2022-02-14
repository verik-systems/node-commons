import * as fs from "fs"
import * as mkdirp from "mkdirp"
import * as path from "path"

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
}
