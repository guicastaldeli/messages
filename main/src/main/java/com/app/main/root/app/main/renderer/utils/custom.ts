import { Chat } from "@/public/data/mesh/chat";
import { Fresnel } from "@/public/data/mesh/fresnel";
import { MeshData } from "../mesh/mesh-data";
import { Transform } from "./transform";

export class Custom {
    private chat: Chat;

    public isChat: boolean = false;
    public isFresnel: boolean = false;

    constructor() {
        this.chat = new Chat();
    }

    /**
     * Chat
     */
    private setChat(
        data: MeshData, 
        color: [number, number, number], 
        transform: Transform
    ): [number, number, number] {
        const cRes = this.chat.set(data, this.isChat, color, transform);
        this.isChat = cRes.isChat;
        return cRes.color;
    }


    /**
     * Fresnel
     */
    private setFresnel(data: MeshData): void {
        const fRes = Fresnel.set(data, this.isFresnel);
        this.isFresnel = fRes.isFresnel;
    }

    /**
     * Init
     */
    public init(
        data: MeshData, 
        color: [number, number, number], 
        transform: Transform
    ): [number, number, number] {
        color = this.setChat(data, color, transform);
        this.setFresnel(data);
        return color;
    }

    /**
     * Update
     */
    public update(transform: Transform): void {
        this.chat.update(transform);
    }

    /**
     * Set
     */
    public set(
        transform: Transform,
        enabled: boolean, 
        speed: number, 
        height: number
    ): void {
        this.chat.setFloatingProps(
            transform,
            enabled,
            speed,
            height
        );
    }
}