import { ReactElement } from "react";
import { ContentGetter } from "../../content-getter";

type Types = 'self' | 'other' | 'update';
type Data = {
    username: string;
    content: string;
    data: string;
}

export class MessageTypes {
    private contentGetter: ContentGetter;

    constructor(contentGetter: ContentGetter) {
        this.contentGetter = contentGetter;
    }

    public content: Record<Types, (data: Data) => ReactElement | string> = {
        self: (data) => this.contentGetter.__self(data),
        other: (data) => this.contentGetter.__other(data),
        update: (data) => {
            const updateData = typeof data === 'string' ? data : data.data;
            return this.contentGetter.__update({ data: updateData });
        }
    }
}