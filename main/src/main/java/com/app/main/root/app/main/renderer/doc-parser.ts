export interface PropertyConfig {
    type: 'number' | 'string' | 'boolean' | 'vector3' | 'color';
    defaultValue?: any;
    required?: boolean;
}

export interface ElementSchema {
    [propertyName: string]: PropertyConfig;
}

export interface SceneSchema {
    [elementType: string]: ElementSchema;
}

export interface ParsedElement {
    type: string;
    properties: { [key: string]: any };
    children: ParsedElement[];
}

export interface SceneConfig {
    elements: ParsedElement[];
}

export class DocParser {
    private static defaultSchema: SceneSchema = {
        camera: {
            'position-x': { type: 'number', defaultValue: 0 },
            'position-y': { type: 'number', defaultValue: 0 },
            'position-z': { type: 'number', defaultValue: 5 },
            'target-x': { type: 'number', defaultValue: 0 },
            'target-y': { type: 'number', defaultValue: 0 },
            'target-z': { type: 'number', defaultValue: 0 },
            'up-x': { type: 'number', defaultValue: 0 },
            'up-y': { type: 'number', defaultValue: 1 },
            'up-z': { type: 'number', defaultValue: 0 },
            fov: { type: 'number', defaultValue: 60 },
            near: { type: 'number', defaultValue: 0.1 },
            far: { type: 'number', defaultValue: 1000 }
        },
        mesh: {
            type: { type: 'string', required: true },
            'position-x': { type: 'number', defaultValue: 0 },
            'position-y': { type: 'number', defaultValue: 0 },
            'position-z': { type: 'number', defaultValue: 0 },
            'rotation-x': { type: 'number', defaultValue: 0 },
            'rotation-y': { type: 'number', defaultValue: 0 },
            'rotation-z': { type: 'number', defaultValue: 0 },
            'scale-x': { type: 'number', defaultValue: 1 },
            'scale-y': { type: 'number', defaultValue: 1 },
            'scale-z': { type: 'number', defaultValue: 1 },
            texture: { type: 'string' },
            followRotation: { type: 'boolean', defaultValue: false },
            autoRotate: { type: 'boolean', defaultValue: false },
            rotationSpeed: { type: 'number', defaultValue: 1.0 },
            visible: { type: 'boolean', defaultValue: true }
        },
        light: {
            type: { type: 'string', required: false },
            'position-x': { type: 'number', defaultValue: 0 },
            'position-y': { type: 'number', defaultValue: 0 },
            'position-z': { type: 'number', defaultValue: 0 },
            'color-r': { type: 'number', defaultValue: 1 },
            'color-g': { type: 'number', defaultValue: 1 },
            'color-b': { type: 'number', defaultValue: 1 },
            intensity: { type: 'number', defaultValue: 1.0 },
            range: { type: 'number', defaultValue: 10 }
        },
        group: {
            name: { type: 'string' },
            'position-x': { type: 'number', defaultValue: 0 },
            'position-y': { type: 'number', defaultValue: 0 },
            'position-z': { type: 'number', defaultValue: 0 },
            'rotation-x': { type: 'number', defaultValue: 0 },
            'rotation-y': { type: 'number', defaultValue: 0 },
            'rotation-z': { type: 'number', defaultValue: 0 },
            'scale-x': { type: 'number', defaultValue: 1 },
            'scale-y': { type: 'number', defaultValue: 1 },
            'scale-z': { type: 'number', defaultValue: 1 }
        }
    }

    private static sceneSchema: SceneSchema = {}

    /**
     * Register Schema
     */
    public static registerSchema(elementType: string, schema: ElementSchema): void {
        this.sceneSchema[elementType] = schema;
    }

    /**
     * Parse Scene
     */
    public static parseScene(xmlContent: string): SceneConfig {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        
        const parseError = xmlDoc.querySelector('parsererror');
        if(parseError) {
            throw new Error(`XML parsing error: ${parseError.textContent}`);
        }

        const sceneElement = xmlDoc.documentElement;
        if(!sceneElement || sceneElement.nodeName !== 'scene') {
            throw new Error('Root element must be <scene>');
        }

        return {
            elements: this.parseElement(sceneElement)
        };
    }

    /**
     * Parse Element
     */
    private static parseElement(element: Element): ParsedElement[] {
        const result: ParsedElement[] = [];
        
        for(let i = 0; i < element.children.length; i++) {
            const child = element.children[i];
            const elementType = child.nodeName.toLowerCase();
            const isPropertyElement = [
                'position', 
                'target', 
                'rotation', 
                'scale', 
                'texture', 
                'followrotation', 
                'visible', 
                'type'
            ].includes(elementType);
            if(isPropertyElement) {
                console.log(`Skipping property element: ${elementType}`);
                continue;
            }
            
            console.log(`Parsing element: ${elementType}`);
            console.log('Element attributes:', Array.from(child.attributes).map(attr => `${attr.name}="${attr.value}"`));
            
            const schema = this.sceneSchema[elementType] || this.defaultSchema[elementType];
            
            if(!schema) {
                console.warn(`Unknown element type: ${elementType}`);
                continue;
            }

            const parsedElement: ParsedElement = {
                type: elementType,
                properties: {},
                children: []
            };

            this.parseProperties(child, schema, parsedElement.properties);
            parsedElement.children = this.parseElement(child);
            
            console.log(`Parsed element ${elementType}:`, parsedElement.properties);
            result.push(parsedElement);
        }

        return result;
    }

    /**
     * Parse Properties
     */
    private static parseProperties(element: Element, schema: ElementSchema, properties: any): void {
        for(let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            const propConfig = schema[attr.name];
            
            if(propConfig) {
                properties[attr.name] = this.parseValue(attr.value, propConfig.type);
            }
        }
        for(let i = 0; i < element.children.length; i++) {
            const child = element.children[i];
            const propConfig = schema[child.nodeName];
            
            if(propConfig) {
                if(this.isComplexType(propConfig.type)) {
                    properties[child.nodeName] = this.parseProperty(child, propConfig.type);
                } else {
                    properties[child.nodeName] = this.parseValue(child.textContent || '', propConfig.type);
                }
            }
        }
        for(const [propName, config] of Object.entries(schema)) {
            if(config.required && properties[propName] === undefined) {
                throw new Error(`Required property '${propName}' is missing for element '${element.nodeName}'`);
            }
            if(properties[propName] === undefined && config.defaultValue !== undefined) {
                properties[propName] = config.defaultValue;
            }
        }
    }

    private static parseProperty(element: Element, type: string): any {
        switch (type) {
            case 'vector3':
                return {
                    x: parseFloat(element.getAttribute('x') || '0'),
                    y: parseFloat(element.getAttribute('y') || '0'),
                    z: parseFloat(element.getAttribute('z') || '0')
                };
            case 'color':
                return {
                    r: parseFloat(element.getAttribute('r') || '1'),
                    g: parseFloat(element.getAttribute('g') || '1'),
                    b: parseFloat(element.getAttribute('b') || '1')
                };
            default:
                return this.parseValue(element.textContent || '', type as any);
        }
    }

    /**
     * Parse Value
     */
    private static parseValue(value: string, type: string): any {
        switch (type) {
            case 'number':
                return parseFloat(value) || 0;
            case 'boolean':
                return value.toLowerCase() === 'true';
            case 'string':
                return value;
            default:
                return value;
        }
    }

    private static isComplexType(type: string): boolean {
        return ['vector3', 'color'].includes(type);
    }

    /**
     * Validate Config
     */
    public static validateConfig(config: SceneConfig): string[] {
        const errors: string[] = [];
        
        const validateElement = (element: ParsedElement, path: string = '') => {
            const schema = this.sceneSchema[element.type] || this.defaultSchema[element.type];
            if(!schema) {
                errors.push(`Unknown element type '${element.type}' at ${path}`);
                return;
            }

            for(const [propName, propConfig] of Object.entries(schema)) {
                if(propConfig.required && element.properties[propName] === undefined) {
                    errors.push(`Missing required property '${propName}' for ${path}${element.type}`);
                }
            }
            for(const [propName, propValue] of Object.entries(element.properties)) {
                const propConfig = schema[propName];
                if(propConfig) {
                    const expectedType = propConfig.type;
                    if(!this.isValueOfType(propValue, expectedType)) {
                        errors.push(`Property '${propName}' at ${path}${element.type} should be of type ${expectedType}`);
                    }
                }
            }

            element.children.forEach((child, index) => {
                validateElement(child, `${path}${element.type}[${index}].`);
            });
        };

        config.elements.forEach((element, index) => {
            validateElement(element, `scene[${index}].`);
        });

        return errors;
    }

    private static isValueOfType(value: any, type: string): boolean {
        switch (type) {
            case 'number':
                return typeof value === 'number';
            case 'string':
                return typeof value === 'string';
            case 'boolean':
                return typeof value === 'boolean';
            case 'vector3':
                return value && typeof value.x === 'number' && typeof value.y === 'number' && typeof value.z === 'number';
            case 'color':
                return value && typeof value.r === 'number' && typeof value.g === 'number' && typeof value.b === 'number';
            default:
                return true;
        }
    }
}