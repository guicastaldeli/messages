package com.app.main.root.app._utils;

public class FunctionalInterfaces {
    @FunctionalInterface
    public static interface Function4<A, B, C, D, R> {
        R apply(A a, B b, C c, D d);
    }

    @FunctionalInterface
    public static interface TriConsumer<A, B, C> {
        void accept(A a, B b, C c);
    }
}