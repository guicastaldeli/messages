package com.app.main.root.app.__config;

public class Loading {
    public static final String INIT_MSG = "Initializing...";
    public static final String DONE_MSG = "Done!...";

    public static void loading() {
        System.out.println(INIT_MSG);
    }

    public static void finished() {
        System.out.println(DONE_MSG);
    }

    public static void main(String[] args) {
        if(args.length > 0 && "init".equals(args[0])) {
            System.out.print(INIT_MSG);
        }
        if(args.length > 0 && "done".equals(args[0])) {
            System.out.print(DONE_MSG);
        }
    }
}
