import { Chat } from "@/public/data/mesh/chat";
import { Fresnel } from "@/public/data/mesh/fresnel";
import { MeshData } from "../mesh/mesh-data";
import { Transform } from "./transform";

export class Custom {
    public static isChat: boolean = false;
    public static isFresnel: boolean = false;

    /**
     * Chat
     */
    private static setChat(
        data: MeshData, 
        color: [number, number, number], 
        transform: Transform
    ): void {
        const cRes = Chat.set(data, this.isChat, color, transform);
        this.isChat = cRes.isChat;
    }

    /**
     * Fresnel
     */
    private static setFresnel(data: MeshData): void {
        const fRes = Fresnel.set(data, this.isFresnel);
        this.isFresnel = fRes.isFresnel;
    }

    /**
     * Init
     */
    public static init(
        data: MeshData, 
        color: [number, number, number], 
        transform: Transform
    ): void {
        this.setChat(data, color, transform);
        this.setFresnel(data);
    }

    /**
     * Update
     */
    public static update(transform: Transform): void {
        Chat.update(transform);
    }

    /**
     * Set
     */
    public static set(
        transform: Transform,
        enabled: boolean, 
        speed: number, 
        height: number
    ): void {
        Chat.setFloatingProps(
            transform,
            enabled,
            speed,
            height
        );
    }
}