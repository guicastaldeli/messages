#pragma once
#include "../context.h"

size_t getIVSize(EncryptionAlgo algo);
int generateIV(EncoderContext* ctx);

