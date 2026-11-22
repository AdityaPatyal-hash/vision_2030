import 'dart:io';
import 'package:serverpod/serverpod.dart';

class RouteRoot extends WidgetRoute {
  @override
  Future<AbstractWidget> build(Session session, HttpRequest request) async {
    final file = File('web/index.html');
    if (await file.exists()) {
      final html = await file.readAsString();
      return WidgetHtml(html: html);
    }
    return WidgetHtml(html: '<h1>MIRA Frontend not found in web/</h1>');
  }
}
