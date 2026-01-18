import { MeshData } from "@/app/main/renderer/mesh/mesh-data";
import { MeshRenderer } from "@/app/main/renderer/mesh/mesh-renderer";
import { Tick } from "@/app/main/renderer/tick";
import { getRandomColor } from "@/app/main/renderer/utils/RandomColor";
import { Transform } from "@/app/main/renderer/utils/transform";

/**
 * 
 * 
 *      Chat Mesh General Configuration...
 * 
 * 
 */

export class Chat {
    public static floatingEnabled: boolean = false;
    public static floatingSpeed: number = 1.0;
    public static floatingHeight: number = 0.2;
    public static floatingTime: number = 0.0;
    public static originalY: number = 0.0;

    /**
     * Set Mesh Config
     */
    public static set(
        data: MeshData, 
        isChat: boolean,
        color: [number, number, number],
        transform: Transform
    ): { isChat: boolean } {
        this.originalY = transform.position[1];

        if(data.name.includes('chat')) {
            this.floatingEnabled = true;
        }
        if(data.name.includes('chat') && 
            !data.name.includes('chatdot')
        ) {
            isChat = true;
        } else {
            isChat = false;
        }
        if(isChat) {
            color = getRandomColor();
        }

        return { isChat }
    }
    
    /**
     * Assign Random Props
     */
    public static assignRandomProps(meshes: MeshRenderer[]): void {
        const pairs: Map<string, MeshRenderer[]> = new Map();

        meshes.forEach(m => {
            const data = m.getMeshData();
            if(data && 
                (data.name.includes('chat') || 
                data.name.includes('chatdot'))
            ) {
                const posKey = 
                    `${m.transform.position[0]},
                    ${m.transform.position[1]},
                    ${m.transform.position[2]}`;
                if(!pairs.has(posKey)) {
                    pairs.set(posKey, [])
                }
                pairs.get(posKey)!.push(m);
            }
        });
        pairs.forEach(p => {
            const floatingSpeed = 0.2 + Math.random() * 0.6;
            const floatingHeight = 0.05 + Math.random() * 0.1;
            p.forEach(m => {
                const data = m.getMeshData();
                if(data) {
                    this.setFloatingProps(
                        m.transform,
                        true,
                        floatingSpeed,
                        floatingHeight
                    );
                }
            });
        });
    }

    /**
     * Floating Props
     */
    public static setFloatingProps(
        transform: Transform,
        enabled: boolean, 
        speed: number, 
        height: number
    ): void {
        this.floatingEnabled = enabled;
        this.floatingSpeed = speed
        this.floatingHeight = height;
        this.originalY = transform.position[1];
    }

    /**
     * Update
     */
    public static update(transform: Transform): void {
        if(!this.floatingEnabled) return;

        this.floatingTime += Tick.getDeltaTime() * this.floatingSpeed;

        const offsetY = Math.sin(this.floatingTime) * this.floatingHeight;

        const [x, _, z] = transform.position;
        transform.setPosition(x, this.originalY + offsetY, z);
    }
}