package com.app.main.root.app._data;

public enum CommandSystemMessageList {
    /*
    * ~~~ USER GROUP ACTIONS ~~~ 
    */
    USER_JOINED_GROUP(
        "{username} joined"
    ),
    USER_LEFT_GROUP(
        "{username} left"
    ),
    USER_ADDED_GROUP(
        "{username} was added"
    ),
    USER_REMOVED_GROUP(
        "{username} was removed"
    ),

    /*
    * ~~~ GROUP ACTIONS ~~~ 
    */
    GROUP_CREATED(
        "{group} was created"
    ),
    GROUP_DELETED(
        "{group} was terminated"
    );

    /* Main */
    private String messsage;

    CommandSystemMessageList(String messsage) {
        this.messsage = messsage;
    }

    public String get() {
        return messsage;
    }
}
