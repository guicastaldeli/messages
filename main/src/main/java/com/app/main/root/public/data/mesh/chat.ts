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
    public floatingEnabled: boolean = false;
    public floatingSpeed: number = 1.0;
    public floatingHeight: number = 0.2;
    public floatingTime: number = 0.0;
    public originalY: number = 0.0;

    /**
     * Set Mesh Config
     */
    public set(
        data: MeshData, 
        isChat: boolean,
        color: [number, number, number],
        transform: Transform
    ): { isChat: boolean, color: [number, number, number] } {
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

        return { isChat, color }
    }
    
    /**
     * Assign Random Props
     */
    public assignRandomProps(meshes: MeshRenderer[]): void {
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
    public setFloatingProps(
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
    public update(transform: Transform): void {
        if(!this.floatingEnabled) return;

        this.floatingTime += Tick.getDeltaTime() * this.floatingSpeed;

        const offsetY = Math.sin(this.floatingTime) * this.floatingHeight;

        const [x, _, z] = transform.position;
        transform.setPosition(x, this.originalY + offsetY, z);
    }
}