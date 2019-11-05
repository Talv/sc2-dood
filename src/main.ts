import * as path from 'path';
import * as fs from 'fs-extra';
import * as sax from 'sax';
import { logger } from './logger';

export const enum ObjectKind {
    ObjectDoodad = 'ObjectDoodad',
}

export const enum ObjectFlags {
    HeightAbsolute    = 'HeightAbsolute',
    ForcePlacement    = 'ForcePlacement',
    NoDoodadFootprint = 'NoDoodadFootprint',
    HeightOffset      = 'HeightOffset',
    DisableNoFlyZone  = 'DisableNoFlyZone',
}

export interface ObjectBase {
    kind: ObjectKind;
    Id: number;
};

export interface ObjectDoodad extends ObjectBase {
    Type: string;
    Name: string;
    Position: string;
    Scale: string;
    Rotation?: string;
    Variation?: string;
    Pitch?: string;
    Roll?: string;
    TileSet?: string; /* ?? */
    TintColor?: string;
    TeamColor?: string;
    Flag: ObjectFlags[];
}

export const enum ObjectWriterFlags {
    HeightOffset           = 1 << 0,
    ContainsScale          = 1 << 8,
    ContainsModelVariation = 1 << 9,
    ContainsRotation       = 1 << 10,
    ContainsYPR            = 1 << 11,
    ContainsTint           = 1 << 12,
    ContainsTeamColor      = 1 << 13,
}

export function wrapAngle(angle: number) {
    angle = angle % 360;
    // force it to be the positive remainder, so that 0 <= angle < 360
    angle = (angle + 360) % 360;
    // force into the minimum absolute value residue class, so that -180 < angle <= 180
    if (angle > 180) {
        angle -= 360;
    }
    return angle;
}

export function radiansToDegrees(angle: number) {
    return wrapAngle((angle - Math.PI) / Math.PI * -180.0 + 180.0);
}

function safeId(str: string) {
    return str.replace(/[^\w_]/g, '_');
}

interface S2Document {
    name: string;
}

export abstract class ObjectsWriter {
    protected out: fs.WriteStream;

    open(stream: fs.WriteStream) {
        this.out = stream;
    }

    close() {
        this.out.end();
    }

    abstract begin(): void;
    abstract end(): void;
    abstract beginDocument(doc: S2Document): void;
    abstract endDocument(doc: S2Document): void;
    abstract processObject(obj: ObjectDoodad, oflags: ObjectWriterFlags, idx: number): void;
}

export class ObjectsGalaxyWriter extends ObjectsWriter {
    protected count = 0;
    protected relativeCount = 0;
    protected documents: S2Document[] = [];

    begin() {
    }

    end() {
        this.out.write(`void gf__opopulate() {\n`);
        this.out.write(`gv__oc = 0;\n`);
        for (const tmp of this.documents) {
            this.out.write(`gf__dp_${safeId(tmp.name)}();\n`);
        }
        this.out.write(`}\n`);
    }

    beginDocument(doc: S2Document) {
        this.relativeCount = 0;
        this.documents.push(doc);
        this.out.write(`void gf__dp_${safeId(doc.name)}() {\n`);
    }

    endDocument(doc: S2Document) {
        this.out.write(`gv__oc += ${this.relativeCount};\n`);
        this.out.write(`}\n`);
    }

    processObject(obj: ObjectDoodad, oflags: ObjectWriterFlags, idx: number) {
        this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_type = "${obj.Type}";\n`);
        const pos = obj.Position.split(',');
        this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_x = ${pos[0]};\n`);
        this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_y = ${pos[1]};\n`);
        this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_z = ${pos[2]};\n`);
        if (obj.Variation) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_variation = ${obj.Variation};\n`);
        }
        if (obj.Scale) {
            const scaleArgs = obj.Scale.split(',');
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_scale_x = ${scaleArgs[0]};\n`);
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_scale_y = ${scaleArgs[1]};\n`);
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_scale_z = ${scaleArgs[2]};\n`);
        }
        if (obj.Rotation) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_yaw = ${radiansToDegrees(parseFloat(obj.Rotation)).toPrecision(8)};\n`);
        }
        if (obj.Pitch) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_pitch = ${radiansToDegrees(parseFloat(obj.Pitch)).toPrecision(8)};\n`);
        }
        if (obj.Roll) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_roll = ${radiansToDegrees(parseFloat(obj.Roll)).toPrecision(8)};\n`);
        }
        if (obj.TintColor) {
            const tintArgs = obj.TintColor.split(' ');
            const tintComponents = tintArgs[0].split(',').map((value) => parseFloat(value) / 2.5);
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_tint_col = Color(${tintComponents.join(',')});\n`);
            if (tintArgs.length > 1) {
                this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_tint_hdr = ${tintArgs[1]};\n`);
            }
        }
        if (obj.TeamColor) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_teamc = ${obj.TeamColor};\n`);
        }
        if (oflags !== 0) {
            this.out.write(`gv__o[gv__oc + ${this.relativeCount}].lv_flags = 0x${oflags.toString(16)};\n`);
        }
        this.count = idx + 1;
        this.relativeCount++;
    }
}

enum UserTypeFieldType {
    GameLink = 'GameLink',
    Int = 'Int',
    Fixed = 'Fixed',
    Color = 'Color',
}

export class UserTypeWriter extends ObjectsWriter {
    begin() {
        this.out.write(`<?xml version="1.0" encoding="us-ascii"?>
<Catalog>`);
    }

    end() {
        this.out.write(`
</Catalog>\n`);
    }

    beginDocument(doc: S2Document) {
        this.out.write(`
\t<CUser id="d_${safeId(doc.name)}">
\t\t<Fields Id="actorLink" Type="GameLink" GameLinkType="Actor" EditorColumn="1"/>
\t\t<Fields Id="flags" Type="Int"/>
\t\t<Fields Id="variation" Type="Int" EditorColumn="2"/>
\t\t<Fields Id="posX" Type="Fixed" EditorColumn="10"/>
\t\t<Fields Id="posY" Type="Fixed" EditorColumn="11"/>
\t\t<Fields Id="posZ" Type="Fixed" EditorColumn="12"/>
\t\t<Fields Id="yaw" Type="Fixed"/>
\t\t<Fields Id="pitch" Type="Fixed"/>
\t\t<Fields Id="roll" Type="Fixed"/>
\t\t<Fields Id="scaleX" Type="Fixed"/>
\t\t<Fields Id="scaleY" Type="Fixed"/>
\t\t<Fields Id="scaleZ" Type="Fixed"/>
\t\t<Fields Id="tintColor" Type="Color"/>
\t\t<Fields Id="tintMultiplier" Type="Fixed"/>
\t\t<Fields Id="teamColorIndex" Type="Int"/>
\t\t<Instances Id="[Default]"/>`);
    }

    endDocument(doc: S2Document) {
        this.out.write(`
\t</CUser>`);
    }

    private writeInstanceField(type: keyof typeof UserTypeFieldType, id: string, value: string) {
        this.out.write(`
\t\t\t<${type} ${type}="${value}">
\t\t\t\t<Field Id="${id}"/>
\t\t\t</${type}>`);
    }

    processObject(obj: ObjectDoodad, oflags: ObjectWriterFlags, idx: number) {
        this.out.write(`
\t\t<Instances Id="${idx}">`);
        this.writeInstanceField('GameLink', 'actorLink', obj.Type)
        const pos = obj.Position.split(',');
        this.writeInstanceField('Fixed', 'posX', pos[0])
        this.writeInstanceField('Fixed', 'posY', pos[1])
        this.writeInstanceField('Fixed', 'posZ', pos[2])
        if (obj.Variation) {
            this.writeInstanceField('Int', 'variation', obj.Variation)
        }
        if (obj.Scale) {
            const scaleArgs = obj.Scale.split(',');
            this.writeInstanceField('Fixed', 'scaleX', scaleArgs[0])
            this.writeInstanceField('Fixed', 'scaleY', scaleArgs[1])
            this.writeInstanceField('Fixed', 'scaleZ', scaleArgs[2])
        }
        if (obj.Rotation) {
            this.writeInstanceField('Fixed', 'yaw', radiansToDegrees(parseFloat(obj.Rotation)).toPrecision(8));
        }
        if (obj.Pitch) {
            this.writeInstanceField('Fixed', 'pitch', radiansToDegrees(parseFloat(obj.Pitch)).toPrecision(8));
        }
        if (obj.Roll) {
            this.writeInstanceField('Fixed', 'roll', radiansToDegrees(parseFloat(obj.Roll)).toPrecision(8));
        }
        if (obj.TintColor) {
            const tintArgs = obj.TintColor.split(' ');
            const tintComponents = tintArgs[0].split(',').map((value) => parseFloat(value) / 2.5);
            this.writeInstanceField('Color', 'tintColor', `255,${tintComponents.join(',')}`)
            if (tintArgs.length > 1) {
                this.writeInstanceField('Fixed', 'tintMultiplier', tintArgs[1])
            }
        }
        if (obj.TeamColor) {
            this.writeInstanceField('Int', 'teamColorIndex', obj.TeamColor)
        }
        this.writeInstanceField('Int', 'flags', oflags.toString())
        this.out.write(`
\t\t</Instances>`);
    }
}

function flagsForObject(obj: ObjectDoodad) {
    let flags: ObjectWriterFlags = 0;

    if (obj.Variation) {
        flags |= ObjectWriterFlags.ContainsModelVariation;
    }
    if (obj.Scale) {
        flags |= ObjectWriterFlags.ContainsScale;
    }
    if (obj.Rotation) {
        flags |= ObjectWriterFlags.ContainsRotation;
    }
    if (obj.Pitch) {
        flags |= ObjectWriterFlags.ContainsYPR;
    }
    if (obj.Roll) {
        flags |= ObjectWriterFlags.ContainsYPR;
    }
    if (obj.TintColor) {
        flags |= ObjectWriterFlags.ContainsTint;
    }
    if (obj.TeamColor) {
        flags |= ObjectWriterFlags.ContainsTeamColor;
    }

    for (const i in obj.Flag) {
        switch (obj.Flag[i]) {
            case ObjectFlags.HeightOffset:
            {
                flags |= ObjectWriterFlags.HeightOffset;
                break;
            }
            default: break;
        }
    }

    return flags;
}

export class ObjectsSAXHandler extends sax.SAXParser {
    protected objWriter: ObjectsWriter;
    protected currentObject?: ObjectDoodad = null;
    protected currentIndex: number = 0;

    constructor(objWriter: ObjectsWriter) {
        super(true);
        this.objWriter = objWriter;
    }

    onready() {
    }

    onend() {
    }

    onerror(e: Error) {
        console.error(e);
        this.resume();
    }

    onopentag(tag: sax.Tag) {
        if (!this.currentObject) {
            switch (tag.name) {
                case ObjectKind.ObjectDoodad:
                {
                    this.currentObject = <any>{
                        kind: ObjectKind.ObjectDoodad,
                        Flag: [],
                    };
                    for (const attrName in tag.attributes) {
                        (<any>(this.currentObject))[attrName] = tag.attributes[attrName];
                    }
                    break;
                }
            }
        }
        else {
            switch (tag.name) {
                case 'Flag':
                {
                    if (tag.attributes['Value'] !== '1') break;
                    this.currentObject.Flag.push(<ObjectFlags>(tag.attributes['Index']));
                    break;
                }
            }
        }
    }

    onclosetag(tagName: string) {
        if (!this.currentObject || this.currentObject.kind !== tagName) return;
        this.objWriter.processObject(this.currentObject, flagsForObject(this.currentObject), this.currentIndex++);
        this.currentObject = void 0;
    }

    async processSource(dirpath: string) {
        const filename = path.join(dirpath, 'Objects');
        if (!await fs.pathExists(filename)) {
            logger.error(`"${filename}" doesn't exist`);
            return;
        }

        logger.info(`Reading "${dirpath}"..`);
        const prevIndex = this.currentIndex;
        const s2doc: S2Document = { name: path.basename(dirpath, '.SC2Map') };
        this.objWriter.beginDocument(s2doc);
        this.write(await fs.readFile(filename, 'utf8'));
        this.objWriter.endDocument(s2doc);
        logger.info(`+${this.currentIndex - prevIndex} entries`);
    }
}
