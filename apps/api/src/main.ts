import 'reflect-metadata';
import 'dotenv/config';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';

/** API composition root. Domain and infrastructure modules are registered here. */
@Module({ imports: [DatabaseModule], controllers: [HealthController] })
class AppModule {}

/**
 * Starts the HTTP application with Fastify instead of Nest's default Express adapter.
 *
 * @see https://querry-kit.github.io/querry-kit/docs/nest/guide/main-bootstrap/
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? '3101'), process.env.HOST ?? '127.0.0.1');
}

await bootstrap();
