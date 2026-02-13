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
        tree \
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

# CRITICAL: Find key_derivation.cpp and copy it to ALL modules that need it
RUN echo "🔍 Locating key_derivation.cpp..." && \
    KEY_DERIV_SOURCE=$(find /app -name "key_derivation.cpp" -type f | head -1) && \
    if [ -z "$KEY_DERIV_SOURCE" ]; then \
        echo "❌ ERROR: key_derivation.cpp not found anywhere!"; \
        echo "Searching all .cpp files:"; \
        find /app -name "*.cpp" -type f | head -20; \
        exit 1; \
    fi && \
    echo "✅ Found key_derivation.cpp at: $KEY_DERIV_SOURCE" && \
    echo "📋 Copying to all modules..." && \
    cp -v "$KEY_DERIV_SOURCE" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/ && \
    cp -v "$KEY_DERIV_SOURCE" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/ && \
    cp -v "$KEY_DERIV_SOURCE" /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/ && \
    cp -v "$KEY_DERIV_SOURCE" /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/ && \
    echo "✅ key_derivation.cpp copied to all modules"

# Also copy key_derivation.h if it exists
RUN KEY_DERIV_HEADER=$(find /app -name "key_derivation.h" -type f | head -1) && \
    if [ -n "$KEY_DERIV_HEADER" ]; then \
        echo "✅ Found key_derivation.h at: $KEY_DERIV_HEADER"; \
        cp -v "$KEY_DERIV_HEADER" /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/; \
        cp -v "$KEY_DERIV_HEADER" /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/; \
        cp -v "$KEY_DERIV_HEADER" /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/; \
        cp -v "$KEY_DERIV_HEADER" /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/; \
    fi

# Create compilation helper script
RUN echo '#!/bin/bash\n\
set -ex\n\
compile_native() {\n\
    local base_dir=$1\n\
    local output=$2\n\
    \n\
    echo "=========================================="\n\
    echo "🔧 COMPILING: $(basename $output)"\n\
    echo "=========================================="\n\
    echo "📁 Directory: $base_dir"\n\
    echo "📦 Output: $output"\n\
    \n\
    cd "$base_dir" || { echo "Failed to cd to $base_dir"; exit 1; }\n\
    \n\
    echo "📂 Directory contents:"\n\
    ls -la\n\
    \n\
    echo "🔍 Finding C++ source files..."\n\
    CPP_FILES=$(find . -maxdepth 1 -type f -name "*.cpp" 2>&1 | sort)\n\
    \n\
    echo "Raw find output: $CPP_FILES"\n\
    \n\
    if [ -z "$CPP_FILES" ]; then\n\
        echo "❌ ERROR: No .cpp files found!"\n\
        echo "Current directory: $(pwd)"\n\
        echo "Files here:"\n\
        ls -la\n\
        exit 1\n\
    fi\n\
    \n\
    FILE_COUNT=$(echo "$CPP_FILES" | wc -l)\n\
    echo "✅ Found $FILE_COUNT files:"\n\
    echo "$CPP_FILES"\n\
    \n\
    if echo "$CPP_FILES" | grep -q "key_derivation.cpp"; then\n\
        echo "✅ key_derivation.cpp IS in the list!"\n\
    else\n\
        echo "⚠️  WARNING: key_derivation.cpp NOT found"\n\
    fi\n\
    \n\
    mkdir -p .build\n\
    \n\
    echo "🔨 Compiling to object files..."\n\
    OBJ_FILES=""\n\
    count=0\n\
    for cpp_file in $CPP_FILES; do\n\
        count=$((count + 1))\n\
        base_name=$(basename "$cpp_file")\n\
        obj_name="${base_name%.*}.o"\n\
        obj_file=".build/$obj_name"\n\
        \n\
        echo "[$count/$FILE_COUNT] Compiling: $base_name"\n\
        \n\
        g++ -c -fPIC \\\n\
            "$cpp_file" \\\n\
            -o "$obj_file" \\\n\
            -I. \\\n\
            -I/usr/include/openssl \\\n\
            -std=c++17 \\\n\
            -O2 \\\n\
            -Wall \\\n\
            -Wno-unused-parameter || { echo "Compilation failed for $cpp_file"; exit 1; }\n\
        \n\
        echo "  Created: $obj_file"\n\
        ls -lh "$obj_file"\n\
        \n\
        OBJ_FILES="$OBJ_FILES $obj_file"\n\
    done\n\
    \n\
    echo "Object files created:"\n\
    ls -lh .build/\n\
    \n\
    if [ -f ".build/key_derivation.o" ]; then\n\
        echo "✅ key_derivation.o created!"\n\
    else\n\
        echo "⚠️  key_derivation.o not found"\n\
    fi\n\
    \n\
    echo "🔗 Linking shared library..."\n\
    echo "Object files: $OBJ_FILES"\n\
    \n\
    g++ -shared -fPIC \\\n\
        $OBJ_FILES \\\n\
        -o "$output" \\\n\
        -lcrypto \\\n\
        -lssl \\\n\
        -lpthread || { echo "Linking failed"; exit 1; }\n\
    \n\
    echo "✅ Library created:"\n\
    ls -lh "$output"\n\
    \n\
    echo "🔍 Checking symbols..."\n\
    nm -D "$output" | grep -i "KeyDerivation" || echo "No KeyDerivation symbols"\n\
    \n\
    echo "🎉 SUCCESS: $(basename $output)"\n\
    echo "=========================================="\n\
}\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh

# PRE-COMPILATION VERIFICATION
RUN echo "═══════════════════════════════════════════" && \
    echo "PRE-COMPILATION VERIFICATION" && \
    echo "═══════════════════════════════════════════" && \
    for module in message_encoder password_encoder user_validator file_encoder; do \
        echo ""; \
        echo "Checking module: $module"; \
        MODULE_DIR="main/src/main/java/com/app/main/root/app/_crypto/$module"; \
        echo "Directory: $MODULE_DIR"; \
        if [ -f "$MODULE_DIR/key_derivation.cpp" ]; then \
            echo "✅ key_derivation.cpp EXISTS"; \
            ls -lh "$MODULE_DIR/key_derivation.cpp"; \
        else \
            echo "❌ key_derivation.cpp MISSING!"; \
            echo "Contents of $MODULE_DIR:"; \
            ls -la "$MODULE_DIR" | grep ".cpp" || echo "No .cpp files"; \
            exit 1; \
        fi; \
    done && \
    echo "═══════════════════════════════════════════" && \
    echo ""

# Compile all native libraries
RUN echo "🚀 COMPILING ALL NATIVE LIBRARIES 🚀" && \
    echo "" && \
    /usr/local/bin/compile_native.sh \
        main/src/main/java/com/app/main/root/app/_crypto/message_encoder \
        main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so && \
    /usr/local/bin/compile_native.sh \
        main/src/main/java/com/app/main/root/app/_crypto/file_encoder \
        main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so && \
    /usr/local/bin/compile_native.sh \
        main/src/main/java/com/app/main/root/app/_crypto/password_encoder \
        main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so && \
    /usr/local/bin/compile_native.sh \
        main/src/main/java/com/app/main/root/app/_crypto/user_validator \
        main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so && \
    /usr/local/bin/compile_native.sh \
        main/src/main/java/com/app/main/root/app/file_compressor \
        main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so && \
    echo "✅ ALL COMPILATIONS COMPLETE"

# POST-COMPILATION VERIFICATION
RUN echo "" && \
    echo "═══════════════════════════════════════════" && \
    echo "POST-COMPILATION SYMBOL VERIFICATION" && \
    echo "═══════════════════════════════════════════" && \
    for lib in \
        main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so \
        main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so; do \
        echo ""; \
        echo "Checking: $(basename $lib)"; \
        echo "-------------------------------------------"; \
        if nm -D "$lib" 2>/dev/null | grep -i "KeyDerivation" | grep " T " > /dev/null; then \
            echo "✅ KeyDerivation symbols FOUND:"; \
            nm -D "$lib" | grep -i "KeyDerivation" | grep " T " | head -3; \
        else \
            echo "❌❌❌ CRITICAL ERROR: No KeyDerivation symbols!"; \
            echo "This library will fail at runtime!"; \
            echo ""; \
            echo "All defined symbols:"; \
            nm -D "$lib" | grep " T " | head -10; \
            echo ""; \
            echo "Undefined symbols:"; \
            nm -D "$lib" | grep " U " | head -10; \
            exit 1; \
        fi; \
    done && \
    echo "═══════════════════════════════════════════" && \
    echo "✅ ALL SYMBOL VERIFICATIONS PASSED" && \
    echo "═══════════════════════════════════════════"

# Build Spring Boot application
RUN cd main && mvn clean package -DskipTests && \
    echo "✅ SPRING BOOT BUILD COMPLETED"

# Final runtime stage
FROM eclipse-temurin:21-jre
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y \
        curl \
        nodejs \
        libssl3 \
        libstdc++6 \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p \
    /app/lib/native/linux \
    /app/src/main/java/com/app/main/root/public \
    /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys && \
    chmod -R 777 /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys

# Copy native libraries to BOTH locations
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/message_encoder/.build/libmessage_encoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/file_encoder/.build/libfileencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/password_encoder/.build/libpasswordencoder.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/_crypto/user_validator/.build/libuser_validator.so /usr/local/lib/
COPY --from=build /app/main/src/main/java/com/app/main/root/app/file_compressor/.build/libfile_compressor.so /usr/local/lib/

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
    echo '' && \
    echo '=== LIBRARY VERIFICATION ===' && \
    echo 'Libraries in /usr/local/lib:' && \
    ls -lh /usr/local/lib/*.so && \
    echo '' && \
    echo '=== CHECKING libmessage_encoder.so SYMBOLS ===' && \
    echo 'Checking for KeyDerivation symbols...' && \
    nm -D /usr/local/lib/libmessage_encoder.so | grep KeyDerivation || echo 'WARNING: No KeyDerivation symbols found!' && \
    echo '' && \
    echo 'Undefined symbols in libmessage_encoder.so:' && \
    nm -D /usr/local/lib/libmessage_encoder.so | grep ' U ' | head -20 && \
    echo '' && \
    echo 'Defined symbols in libmessage_encoder.so:' && \
    nm -D /usr/local/lib/libmessage_encoder.so | grep ' T ' | head -20 && \
    echo '' && \
    echo 'Library dependencies:' && \
    ldd /usr/local/lib/libmessage_encoder.so && \
    echo '' && \
    echo '=== END VERIFICATION ===' && \
    echo '' && \
    echo 'Checking session-keys directory...' && \
    ls -la /app/src/main/java/com/app/main/root/app/_crypto/message_encoder/keys/ || echo 'Directory not accessible' && \
    if [ \"$APP_ENV\" = \"prod\" ] || [ \"$APP_ENV\" = \"production\" ]; then \
        echo 'Generating production config...' && \
        cd /app && \
        node src/main/java/com/app/main/root/public/generate-config.js && \
        echo 'Config generated successfully'; \
    fi && \
    echo 'Starting Spring Boot server...' && \
    exec java -Djava.library.path=/usr/local/lib:/app/lib/native/linux -jar /app/server.jar \
"]