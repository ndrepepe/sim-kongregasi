import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
// CommonJS export; default import fails at runtime under Nest's compiler.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 4000);
  const origin = config.get<string>('WEB_ORIGIN', 'http://localhost:3000');

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({ origin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API SIM Kongregasi')
      .setDescription('API modular untuk administrasi Kongregasi')
      .setVersion('0.1.0')
      .addCookieAuth('access_token')
      .build()
  );
  SwaggerModule.setup('docs', app, document);
  await app.listen(port, '0.0.0.0');
  console.log(`SIM Kongregasi API aktif di http://localhost:${port}/api`);
}

void bootstrap();
