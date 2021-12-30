/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { v4 } from "uuid";

export class VerikUuidUtils {
  public static generateToken(): string {
    const uuid = v4();
    return uuid;
  }
}
