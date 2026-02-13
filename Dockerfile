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

# Create compilation helper script
RUN echo '#!/bin/bash\n\
compile_native() {\n\
    local dir=$1\n\
    local output=$2\n\
    cd $dir\n\
    echo "=========================================="\n\
    echo "Compiling in: $(pwd)"\n\
    echo "=========================================="\n\
    # Find all .cpp files recursively\n\
    CPP_FILES=$(find . -name "*.cpp" -type f | tr "\\n" " ")\n\
    # Find all directories for includes\n\
    INCLUDE_DIRS=$(find . -type d -not -path "*/\.*" | sed "s/^/-I/" | tr "\\n" " ")\n\
    echo "Found CPP files: $CPP_FILES"\n\
    echo "Include dirs: $INCLUDE_DIRS"\n\
    # Compile\n\
    g++ -shared -fPIC -o $output \\\n\
        $CPP_FILES \\\n\
        $INCLUDE_DIRS \\\n\
        -I/usr/include/openssl \\\n\
        -I/usr/include \\\n\
        -std=c++17 \\\n\
        -O2 \\\n\
        -lcrypto -lssl\n\
    if [ $? -eq 0 ]; then\n\
        echo "✅ Successfully compiled: $(basename $output)"\n\
    else\n\
        echo "❌ Failed to compile: $(basename $output)"\n\
        exit 1\n\
    fi\n\
}\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh

# Compile message_encoder
RUN /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/message_encoder \
    .build/libmessage_encoder.so

# Compile file_encoder
RUN /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/file_encoder \
    .build/libfileencoder.so

# Compile password_encoder
RUN /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/password_encoder \
    .build/libpasswordencoder.so

# Compile user_validator
RUN /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/_crypto/user_validator \
    .build/libuser_validator.so

# Compile file_compressor
RUN /usr/local/bin/compile_native.sh \
    main/src/main/java/com/app/main/root/app/file_compressor \
    .build/libfile_compressor.so

# Build the Spring Boot application
RUN cd main && mvn clean package -DskipTests

# Final stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y \
        curl \
        nodejs \
        libssl3 \
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