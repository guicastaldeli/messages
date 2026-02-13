FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

COPY . .

# Install ALL build dependencies including OpenSSL
RUN apt-get update && \
    apt-get install -y \
        g++ \
        make \
        cmake \
        libssl-dev \
        pkg-config \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create build directories
RUN mkdir -p \
    main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build \
    main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build \
    main/src/main/java/com/app/main/root/app/file_compressor/.build

# First, verify the files exist
RUN ls -la main/src/main/java/com/app/main/root/app/_crypto/message_encoder/

# Compile message_encoder with OpenSSL
RUN cd main/src/main/java/com/app/main/root/app/_crypto/message_encoder && \
    echo "Compiling message_encoder for Linux..." && \
    # Check if key_derivation.cpp exists, if not, create it or find correct name
    if [ ! -f key_derivation.cpp ]; then \
        echo "ERROR: key_derivation.cpp not found!"; \
        find . -name "*.cpp" -ls; \
        exit 1; \
    fi && \
    g++ -shared -fPIC -o .build/libmessage_encoder.so \
        message_encoder.cpp key_derivation.cpp \
        -I. \
        -I/usr/include/openssl \
        -I/usr/include \
        -std=c++17 \
        -O2 \
        -lcrypto -lssl && \
    echo "✅ message_encoder compiled"

# Compile file_encoder
RUN cd main/src/main/java/com/app/main/root/app/_crypto/file_encoder && \
    echo "Compiling file_encoder for Linux..." && \
    g++ -shared -fPIC -o .build/libfileencoder.so \
        file_encoder.cpp \
        -I. -I/usr/include -std=c++17 -O2 && \
    echo "✅ file_encoder compiled"

# Compile password_encoder
RUN cd main/src/main/java/com/app/main/root/app/_crypto/password_encoder && \
    echo "Compiling password_encoder for Linux..." && \
    g++ -shared -fPIC -o .build/libpasswordencoder.so \
        password_encoder.cpp \
        -I. -I/usr/include -std=c++17 -O2 && \
    echo "✅ password_encoder compiled"

# Compile user_validator
RUN cd main/src/main/java/com/app/main/root/app/_crypto/user_validator && \
    echo "Compiling user_validator for Linux..." && \
    g++ -shared -fPIC -o .build/libuser_validator.so \
        user_validator.cpp \
        -I. -I/usr/include -std=c++17 -O2 && \
    echo "✅ user_validator compiled"

# Compile file_compressor
RUN cd main/src/main/java/com/app/main/root/app/file_compressor && \
    echo "Compiling file_compressor for Linux..." && \
    g++ -shared -fPIC -o .build/libfile_compressor.so \
        compressor.cpp \
        -I. -I/usr/include -std=c++17 -O2 && \
    echo "✅ file_compressor compiled"

# Build the Spring Boot application
RUN cd main && mvn clean package -DskipTests

# Final stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install runtime dependencies (only what's needed, not build tools)
RUN apt-get update && \
    apt-get install -y \
        curl \
        nodejs \
        libssl3  # Runtime OpenSSL libraries \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /app/lib/native/linux /app/src/main/java/com/app/main/root/public

# Copy the freshly built native libraries
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /usr/local/lib/

# Also copy to app lib directory
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /app/lib/native/linux/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /app/lib/native/linux/

# Copy SQL files and config scripts
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_db/src/*.sql /app/src/main/java/com/app/main/root/app/_db/src/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/generate-config.js /app/src/main/java/com/app/main/root/public/
COPY --from=build /app/main/src/main/java/com/app/main/root/public/encrypt-url.js /app/src/main/java/com/app/main/root/public/

# Copy the jar file
COPY --from=build /app/main/target/main-0.0.1-SNAPSHOT.jar server.jar

# Set library paths
ENV LD_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux:$LD_LIBRARY_PATH
ENV JAVA_LIBRARY_PATH=/usr/local/lib:/app/lib/native/linux

EXPOSE 3001

# Run config generation then start server
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
        echo 'Config generated successfully'; \
    fi && \
    echo 'Starting Spring Boot server...' && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]