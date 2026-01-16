import { MeshData } from "./mesh/mesh-data";
import { MeshRenderer } from "./mesh/mesh-renderer";
import { Raycaster } from "./raycaster";

export class RotationBox {
    private raycaster: Raycaster;

    private originalRotations: Map<MeshRenderer, [number, number, number]> = new Map();
    private targetRotations: Map<MeshRenderer, [number, number, number]> = new Map();
    private rotationSpeed: number = 0.1;

    public x: number;
    public y: number;
    public width: number;
    public height;

    constructor(
        raycaster: Raycaster,
        props: {
            x: number,
            y: number,
            width: number,
            height: number
        }
    ) {
        this.raycaster = raycaster;
        this.x = props.x;
        this.y = props.y;
        this.width = props.width;
        this.height = props.height;
    }

    /**
     * Is Mesh in Rotation Box
     */
    private isMeshInRotationBox(meshRenderer: MeshRenderer): boolean {
        const modelMatrix = meshRenderer.transform.getModelMatrix();
        const meshPosX = modelMatrix[12];
        const meshPosY = modelMatrix[13];
        const meshPosZ = modelMatrix[14];
        return Math.abs(meshPosZ) < 300;
    }

    /**
     * Update
     */
    public update(meshRenderes: MeshRenderer[]): void {
        const normPos = this.raycaster.getNormalizedMousePos();
        meshRenderes.forEach((meshRenderer) => {
            const meshData = meshRenderer.getMeshData();
            if(meshData && 
                this.shouldFollowRotation(meshData) && 
                this.isMeshInRotationBox(meshRenderer)
            ) {
                const targetRotation = this.raycaster.screenToRotation(normPos.x, normPos.y);
                if(!this.originalRotations.has(meshRenderer)) {
                    this.originalRotations.set(
                        meshRenderer,
                        [...meshRenderer.transform.rotation]
                    );
                }

                this.targetRotations.set(meshRenderer, targetRotation);
                this.applyRotation(meshRenderer, targetRotation);
            } else {
                this.returnToOriginalRotation(meshRenderer);
            }
        });
    }

    /**
     * Apply Rotation
     */
    private applyRotation(
        meshRenderer: MeshRenderer, 
        targetRotation: [
            number, 
            number, 
            number
        ]
    ): void {
        const currentRotation = meshRenderer.transform.rotation;
        const originalRotation = this.originalRotations.get(meshRenderer);
        if(!originalRotation) return;

        const [targetX, targetY, targetZ] = targetRotation;
        const [origX, origY, origZ] = originalRotation;

        const newRotation: [number, number, number] = [
            currentRotation[0] + ((targetX + origX) - currentRotation[0]) * this.rotationSpeed,
            currentRotation[1] + ((targetY + origY) - currentRotation[1]) * this.rotationSpeed,
            currentRotation[2] + ((targetZ + origZ) - currentRotation[2]) * this.rotationSpeed
        ];

        meshRenderer.transform.setRotation(
            newRotation[0],
            newRotation[1],
            newRotation[2]
        );
    } 

    /**
     * Return to Original Rotation
     */
    private returnToOriginalRotation(meshRenderer: MeshRenderer): void {
        if(this.originalRotations.has(meshRenderer)) {
            const originalRotation = this.originalRotations.get(meshRenderer)!;
            const currentRotation = meshRenderer.transform.rotation;

            const newRotation: [number, number, number] = [
                currentRotation[0] + (originalRotation[0] - currentRotation[0]) * this.rotationSpeed,
                currentRotation[1] + (originalRotation[1] - currentRotation[1]) * this.rotationSpeed,
                currentRotation[2] + (originalRotation[2] - currentRotation[2]) * this.rotationSpeed,
            ];

            meshRenderer.transform.setRotation(
                newRotation[0],
                newRotation[1],
                newRotation[2]
            );

            const distance = Math.sqrt(
                Math.pow(newRotation[0] - originalRotation[0], 2) +
                Math.pow(newRotation[1] - originalRotation[1], 2) + 
                Math.pow(newRotation[2] - originalRotation[2], 2)
            );
            if(distance < 0.01) {
                this.originalRotations.delete(meshRenderer);
                this.targetRotations.delete(meshRenderer);
            }
        }
    }

    private shouldFollowRotation(meshData: MeshData): boolean {
        return meshData.enableFollowRotation || false;
    }
}