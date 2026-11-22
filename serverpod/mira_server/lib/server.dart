import 'dart:io';
import 'package:serverpod/serverpod.dart';
import 'src/web/routes/root.dart';

void run(List<String> args) async {
  final pod = Serverpod(
    args,
    Protocol(),
    Endpoints(),
  );

  // Serve static assets (CSS, JS, media)
  pod.webServer.addRoute(RouteStaticDirectory(serverDirectory: 'web'), '/*');

  // SPA fallback routes for client-side React Router
  pod.webServer.addRoute(RouteRoot(), '/');
  pod.webServer.addRoute(RouteRoot(), '/dashboard');
  pod.webServer.addRoute(RouteRoot(), '/vision');
  pod.webServer.addRoute(RouteRoot(), '/connect');

  await pod.start();
}
