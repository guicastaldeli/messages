# Create enhanced compilation helper script with FIXED find command
FROM maven:3.9-eclipse-temurin-21 AS build
RUN echo '#!/bin/bash\n\
set -e\n\
compile_native() {\n\
    local base_dir=$1\n\
    local output=$2\n\
    \n\
    echo "=========================================="\n\
    echo "🔧 COMPILING LIBRARY: $(basename $output)"\n\
    echo "=========================================="\n\
    echo "📁 Base directory: $base_dir"\n\
    echo "📦 Output file: $output"\n\
    echo ""\n\
    \n\
    cd "$base_dir"\n\
    \n\
    echo "🔍 DEBUGGING: Showing directory structure..."\n\
    echo "-------------------------------------------"\n\
    tree -L 4 || find . -type f | head -50\n\
    echo "-------------------------------------------"\n\
    echo ""\n\
    \n\
    # FIXED: Find all C++ source files recursively - CORRECTED SYNTAX\n\
    echo "🔍 STEP 1: Finding all C++ source files..."\n\
    CPP_FILES=$(find . -type f -name "*.cpp" -not -path "*/.build/*" -not -path "*/.*" | sort)\n\
    \n\
    if [ -z "$CPP_FILES" ]; then\n\
        echo "❌ ERROR: No C++ source files found in $base_dir"\n\
        echo "Directory contents:"\n\
        ls -laR\n\
        exit 1\n\
    fi\n\
    \n\
    FILE_COUNT=$(echo "$CPP_FILES" | wc -l)\n\
    echo "✅ Found $FILE_COUNT source file(s):"\n\
    echo "$CPP_FILES" | nl | sed "s/^/  /"\n\
    echo ""\n\
    \n\
    # CRITICAL: Show specifically if key_derivation.cpp was found\n\
    if echo "$CPP_FILES" | grep -i "key_derivation" > /dev/null; then\n\
        echo "✅ key_derivation.cpp FOUND!"\n\
    else\n\
        echo "❌❌❌ WARNING: key_derivation.cpp NOT FOUND!"\n\
        echo "This will cause undefined symbols at runtime!"\n\
    fi\n\
    echo ""\n\
    \n\
    # Find all subdirectories for includes\n\
    echo "🔍 STEP 2: Finding all subdirectories for include paths..."\n\
    INCLUDE_DIRS=$(find . -type d -not -path "*/.build*" -not -path "*/.*" | sed "s|^|-I|" | tr "\\n" " ")\n\
    echo "Include directories: $INCLUDE_DIRS"\n\
    echo ""\n\
    \n\
    # Create .build directory\n\
    mkdir -p .build\n\
    \n\
    # Compile each source file to object file\n\
    echo "🔨 STEP 3: Compiling source files to object files..."\n\
    echo "-------------------------------------------"\n\
    OBJ_FILES=""\n\
    count=0\n\
    for cpp_file in $CPP_FILES; do\n\
        count=$((count + 1))\n\
        base_name=$(basename "$cpp_file")\n\
        obj_name="${base_name%.*}.o"\n\
        obj_file=".build/$obj_name"\n\
        \n\
        echo ""\n\
        echo "  [$count/$FILE_COUNT] 🔨 Compiling: $cpp_file"\n\
        echo "           ↓"\n\
        echo "           $obj_name"\n\
        \n\
        # Show first few lines of the file\n\
        echo "  📄 File preview (first 5 lines):"\n\
        head -5 "$cpp_file" | sed "s/^/     | /"\n\
        \n\
        # Compile with all necessary flags\n\
        if g++ -c -fPIC \\\n\
            "$cpp_file" \\\n\
            -o "$obj_file" \\\n\
            $INCLUDE_DIRS \\\n\
            -I/usr/include/openssl \\\n\
            -I/usr/include \\\n\
            -I. \\\n\
            -std=c++17 \\\n\
            -O2 \\\n\
            -Wall \\\n\
            -Wno-unused-parameter \\\n\
            -DNDEBUG 2>&1; then\n\
            echo "  ✅ SUCCESS: $obj_name created"\n\
            ls -lh "$obj_file" | sed "s/^/     /"\n\
        else\n\
            echo "  ❌ COMPILATION FAILED for $cpp_file"\n\
            exit 1\n\
        fi\n\
        \n\
        OBJ_FILES="$OBJ_FILES $obj_file"\n\
    done\n\
    echo "-------------------------------------------"\n\
    echo ""\n\
    \n\
    echo "🔗 STEP 4: Linking object files into shared library..."\n\
    echo "-------------------------------------------"\n\
    echo "Output: $output"\n\
    echo "Object files: $(echo $OBJ_FILES | wc -w) files"\n\
    echo ""\n\
    echo "Object files being linked:"\n\
    echo "$OBJ_FILES" | tr " " "\\n" | sed "s/^/  - /"\n\
    echo ""\n\
    \n\
    # CRITICAL: Check if key_derivation.o exists\n\
    if echo "$OBJ_FILES" | grep -i "key_derivation.o" > /dev/null; then\n\
        echo "✅ key_derivation.o is included in linking!"\n\
    else\n\
        echo "❌❌❌ ERROR: key_derivation.o NOT FOUND in object files!"\n\
        exit 1\n\
    fi\n\
    echo ""\n\
    \n\
    # Link all object files into shared library\n\
    echo "🔗 Running linker..."\n\
    if g++ -shared -fPIC \\\n\
        $OBJ_FILES \\\n\
        -o "$output" \\\n\
        -lcrypto \\\n\
        -lssl \\\n\
        -lpthread \\\n\
        -Wl,--no-undefined 2>&1; then\n\
        echo "✅ LINKING SUCCESSFUL"\n\
    else\n\
        echo "❌ LINKING FAILED"\n\
        echo "Attempting to show undefined references..."\n\
        g++ -shared -fPIC $OBJ_FILES -o "$output" -lcrypto -lssl -lpthread 2>&1 | grep -i "undefined" | head -20\n\
        exit 1\n\
    fi\n\
    echo "-------------------------------------------"\n\
    echo ""\n\
    \n\
    echo "✅ STEP 5: Verifying the compiled library..."\n\
    echo "-------------------------------------------"\n\
    ls -lh "$output" | sed "s/^/  /"\n\
    echo ""\n\
    \n\
    # Check library dependencies\n\
    echo "📚 Library dependencies:"\n\
    if ldd "$output" > /dev/null 2>&1; then\n\
        ldd "$output" | sed "s/^/  /"\n\
    else\n\
        echo "  ⚠️  ldd check failed, but library may still work"\n\
    fi\n\
    echo ""\n\
    \n\
    # Check for undefined symbols\n\
    echo "🔍 Checking for undefined symbols..."\n\
    UNDEFINED=$(nm -D "$output" 2>/dev/null | grep " U " | grep -v "@@" || true)\n\
    if [ -n "$UNDEFINED" ]; then\n\
        UNDEF_COUNT=$(echo "$UNDEFINED" | wc -l)\n\
        echo "  Found $UNDEF_COUNT undefined symbols (these should only be system libraries):"\n\
        echo "$UNDEFINED" | head -10 | sed "s/^/    /"\n\
        \n\
        # Check specifically for KeyDerivation symbols\n\
        if echo "$UNDEFINED" | grep -i "KeyDerivation" > /dev/null; then\n\
            echo ""\n\
            echo "❌❌❌ CRITICAL ERROR ❌❌❌"\n\
            echo "Found undefined KeyDerivation symbols!"\n\
            echo "This means key_derivation.cpp was NOT compiled properly!"\n\
            echo "$UNDEFINED" | grep -i "KeyDerivation"\n\
            exit 1\n\
        fi\n\
    else\n\
        echo "  ✅ No problematic undefined symbols found"\n\
    fi\n\
    echo ""\n\
    \n\
    # Check for defined symbols (functions we compiled)\n\
    echo "✅ Checking for defined symbols (our functions)..."\n\
    DEFINED=$(nm -D "$output" 2>/dev/null | grep " T " | head -20 || true)\n\
    if [ -n "$DEFINED" ]; then\n\
        DEF_COUNT=$(nm -D "$output" 2>/dev/null | grep " T " | wc -l || echo "0")\n\
        echo "  Found $DEF_COUNT defined functions (showing first 20):"\n\
        echo "$DEFINED" | sed "s/^/    /"\n\
    fi\n\
    \n\
    # CRITICAL: Specifically check for KeyDerivation symbols\n\
    echo ""\n\
    echo "🔍 Checking specifically for KeyDerivation symbols..."\n\
    KEY_DERIV=$(nm -D "$output" 2>/dev/null | grep "KeyDerivation" || true)\n\
    if [ -n "$KEY_DERIV" ]; then\n\
        echo "✅ KeyDerivation symbols found:"\n\
        echo "$KEY_DERIV" | sed "s/^/    /"\n\
    else\n\
        echo "❌❌❌ NO KeyDerivation symbols found in library!"\n\
        exit 1\n\
    fi\n\
    echo "-------------------------------------------"\n\
    echo ""\n\
    \n\
    echo "🎉🎉🎉 SUCCESS! 🎉🎉🎉"\n\
    echo "Library: $(basename $output)"\n\
    echo "Size: $(du -h $output | cut -f1)"\n\
    echo "Source files compiled: $FILE_COUNT"\n\
    echo "=========================================="\n\
    echo ""\n\
}\n\
' > /usr/local/bin/compile_native.sh && chmod +x /usr/local/bin/compile_native.sh