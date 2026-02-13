FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

# Build the Spring Boot application
RUN cd main && mvn clean package -DskipTests

# Final stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install Node.js for runtime config generation
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directory structure for native libraries
RUN mkdir -p /app/lib/native/linux
RUN mkdir -p /app/src/main/java/com/app/main/root/public

# Copy all .so files from the build stage to a standard location
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /app/lib/native/linux/

# Also copy to system library path for wider compatibility
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /usr/local/lib/

COPY --from=build /app/main/src/main/java/com/app/main/root/app/_db/src/*.sql /app/src/main/java/com/app/main/root/app/_db/src/

# Copy config generation scripts (but NOT .env files)
COPY --from=build /app/main/src/main/java/com/app/main/root/public/generate-config.js /app/src/main/java/com/app/main/root/public/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/encrypt-url.js /app/src/main/java/com/app/main/root/public/

# Set library paths
ENV LD_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux:$LD_LIBRARY_PATH
ENV JAVA_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux

# Copy the jar file
COPY --from=build /app/main/target/main-0.0.1-SNAPSHOT.jar server.jar

EXPOSE 3001

# Run config generation then start server using shell
CMD ["/bin/sh", "-c", "\
    echo '=== Starting Application ===' && \
    echo 'Environment: $APP_ENV' && \
    echo 'API_URL: $API_URL' && \
    echo 'SERVER_URL: $SERVER_URL' && \
    echo 'WEB_URL: $WEB_URL' && \
    if [ \"$APP_ENV\" = \"prod\" ] || [ \"$APP_ENV\" = \"production\" ]; then \
        echo 'Generating production config...' && \
        cd /app && \
        node src/main/java/com/app/main/root/public/generate-config.js && \
        echo '✅ Config generated successfully'; \
    fi && \
    echo 'Starting Spring Boot server...' && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]