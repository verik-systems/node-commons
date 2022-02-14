import { Module } from "@nestjs/common"
import { SeederService } from "./seeder.service"

@Module({
  imports: [],
  providers: [SeederService],
})
export class SeederModule {}
