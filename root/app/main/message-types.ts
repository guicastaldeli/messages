import { ReactElement } from "react";
import { ContentGetter } from "../content-getter";

type Types = 'self' | 'other' | 'update';
type Data = {
    username: string;
    text: string;
    data: string;
}

export class MessageTypes {
    private contentGetter: ContentGetter;

    constructor(contentGetter: ContentGetter) {
        this.contentGetter = contentGetter;
    }

    public content: Record<Types, (data: Data) => ReactElement> = {
        self: (data: Data) => this.contentGetter.__self(data),
        other: (data: Data) => this.contentGetter.__other(data),
        update: (data: Data) => this.contentGetter.__update(data.data)
    }
}