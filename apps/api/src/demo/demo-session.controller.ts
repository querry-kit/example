import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { demoLoginInputSchema, type DemoSession } from '@workboard/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { type AuthenticatedRequest, DemoSessionGuard } from './demo-session.guard.js';
import { demoSessionCookie, demoSessionMaxAgeSeconds, DemoSessionService } from './demo-session.service.js';

/** The configured browser origin for this demo; independent of forwarded headers. */
const demoOrigin = process.env.DEMO_ORIGIN ?? 'http://127.0.0.1:3201';
const loopbackOrigin = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.exec(demoOrigin);
const alternateDemoOrigin = loopbackOrigin
  ? `http://${loopbackOrigin[1] === 'localhost' ? '127.0.0.1' : 'localhost'}${loopbackOrigin[2] ?? ''}`
  : undefined;

/** Local-only persona selection. Replace this controller with real authentication when adopting the example. */
@Controller('demo/session')
export class DemoSessionController {
  /** Receives the synthetic account lookup service. */
  constructor(private readonly sessions: DemoSessionService) {}

  /** Starts or replaces the signed browser session after validating its origin and payload. */
  @Post()
  @HttpCode(200)
  async select(
    @Body() input: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<DemoSession> {
    reply.header('Cache-Control', 'no-store');
    const origin = request.headers.origin;
    if (!origin || (origin !== demoOrigin && origin !== alternateDemoOrigin))
      throw new ForbiddenException('Demo login requires the configured origin.');

    const parsed = demoLoginInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException('Select user1, user2, or admin.');

    // Store a signed account ID and expiration, not a browser-supplied role.
    const session = await this.sessions.select(parsed.data.login);
    const expiration = Date.now() + demoSessionMaxAgeSeconds * 1_000;
    reply.setCookie(demoSessionCookie, `${session.id}.${expiration}`, {
      signed: true,
      httpOnly: true,
      sameSite: 'lax',
      secure: demoOrigin.startsWith('https:'),
      path: '/api',
      maxAge: demoSessionMaxAgeSeconds,
    });
    return session;
  }

  /** Returns the authenticated identity and query capabilities. */
  @Get()
  @UseGuards(DemoSessionGuard)
  current(@Req() request: AuthenticatedRequest): DemoSession {
    return request.demoSession;
  }
}
