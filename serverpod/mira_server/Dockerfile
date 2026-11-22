FROM dart:stable AS build

WORKDIR /app
COPY pubspec.* ./
RUN dart pub get

COPY . .
RUN dart compile exe bin/main.dart -o bin/main

FROM debian:bookworm-slim
WORKDIR /app

COPY --from=build /runtime/ /
COPY --from=build /app/bin/main /app/bin/main
COPY --from=build /app/config/ /app/config/
COPY --from=build /app/web/ /app/web/

EXPOSE 8080 8081 8082

CMD ["/app/bin/main", "--mode", "production"]
