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
set -e\n\
compile_native() {\n\
    local base_dir=$1\n\
    local output=$2\n\
    \n\
    echo "=========================================="\n\
    echo "🔧 COMPILING: $(basename $output)"\n\
    echo "=========================================="\n\
    echo "📁 Directory: $base_dir"\n\
    echo "📦 Output: $output"\n\
    echo ""\n\
    \n\
    cd "$base_dir"\n\
    \n\
    # List all files in directory\n\
    echo "📂 Directory contents:"\n\
    ls -la\n\
    echo ""\n\
    \n\
    # Find ALL .cpp files (simple approach)\n\
    echo "🔍 Finding C++ source files..."\n\
    CPP_FILES=$(find . -maxdepth 1 -type f -name "*.cpp" | sort)\n\
    \n\
    if [ -z "$CPP_FILES" ]; then\n\
        echo "❌ ERROR: No .cpp files found!"\n\
        exit 1\n\
    fi\n\
    \n\
    FILE_COUNT=$(echo "$CPP_FILES" | wc -l)\n\
    echo "✅ Found $FILE_COUNT files:"\n\
    echo "$CPP_FILES" | sed "s/^/  - /"\n\
    echo ""\n\
    \n\
    # VERIFY key_derivation.cpp exists\n\
    if echo "$CPP_FILES" | grep -q "key_derivation.cpp"; then\n\
        echo "✅ key_derivation.cpp IS in the list!"\n\
    else\n\
        echo "⚠️  WARNING: key_derivation.cpp NOT found in this module"\n\
    fi\n\
    echo ""\n\
    \n\
    # Create .build directory\n\
    mkdir -p .build\n\
    \n\
    # Compile each source to object file\n\
    echo "🔨 Compiling to object files..."\n\
    OBJ_FILES=""\n\
    count=0\n\
    for cpp_file in $CPP_FILES; do\n\
        count=$((count + 1))\n\
        base_name=$(basename "$cpp_file")\n\
        obj_name="${base_name%.*}.o"\n\
        obj_file=".build/$obj_name"\n\
        \n\
        echo "  [$count/$FILE_COUNT] Compiling: $base_name → $obj_name"\n\
        \n\
        if g++ -c -fPIC \\\n\
            "$cpp_file" \\\n\
            -o "$obj_file" \\\n\
            -I. \\\n\
            -I/usr/include/openssl \\\n\
            -std=c++17 \\\n\
            -O2 \\\n\
            -Wall \\\n\
            -Wno-unused-parameter 2>&1; then\n\
            echo "    ✅ Created $(ls -lh $obj_file | awk '\''{print $9, $5}'\'')"\n\
        else\n\
            echo "    ❌ FAILED"\n\
            exit 1\n\
        fi\n\
        \n\
        OBJ_FILES="$OBJ_FILES $obj_file"\n\
    done\n\
    echo ""\n\
    \n\
    # Verify key_derivation.o was created\n\
    if ls .build/key_derivation.o 2>/dev/null; then\n\
        echo "✅ key_derivation.o successfully created!"\n\
    else\n\
        echo "⚠️  key_derivation.o not found (may not be needed for this module)"\n\
    fi\n\
    echo ""\n\
    \n\
    # Link into shared library\n\
    echo "🔗 Linking shared library..."\n\
    echo "Object files: $(echo $OBJ_FILES | wc -w)"\n\
    \n\
    if g++ -shared -fPIC \\\n\
        $OBJ_FILES \\\n\
        -o "$output" \\\n\
        -lcrypto \\\n\
        -lssl \\\n\
        -lpthread 2>&1; then\n\
        echo "✅ LINKING SUCCESS"\n\
    else\n\
        echo "❌ LINKING FAILED"\n\
        exit 1\n\
    fi\n\
    echo ""\n\
    \n\
    # Verify output\n\
    echo "✅ Library created:"\n\
    ls -lh "$output"\n\
    echo ""\n\
    \n\
    # Check for undefined symbols\n\
    echo "🔍 Symbol check..."\n\
    UNDEFINED=$(nm -D "$output" 2>/dev/null | grep " U " | grep -v "@@" | grep -i "KeyDerivation" || true)\n\
    if [ -n "$UNDEFINED" ]; then\n\
        echo "❌ CRITICAL: Undefined KeyDerivation symbols!"\n\
        echo "$UNDEFINED"\n\
        exit 1\n\
    fi\n\
    \n\
    DEFINED=$(nm -D "$output" 2>/dev/null | grep " T " | grep -i "KeyDerivation" | head -5 || true)\n\
    if [ -n "$DEFINED" ]; then\n\
        echo "✅ KeyDerivation symbols present:"\n\
        echo "$DEFINED" | sed "s/^/  /"\n\
    fi\n\
    echo ""\n\
    \n\
    echo "🎉 SUCCESS: $(basename $output)"\n\
    echo "=========================================="\n\
    echo ""\n\
}\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh

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
    echo 'Checking libraries...' && \
    ls -la /usr/local/lib/*.so && \
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