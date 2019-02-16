import * as fs from 'fs';
import * as sax from 'sax';

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

const enum ObjectWriterFlags {
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

export class ObjectsGalaxyWriter {
    protected script: fs.WriteStream;
    oc: number;

    open(stream: fs.WriteStream) {
        this.script = stream;
    }

    start() {
        this.oc = 0;
        this.script.write(`void gf__opopulate() {\n`);
    }

    close() {
        this.script.write(`gv__oc = ${this.oc};\n`);
        this.script.write(`}\n`);
        this.script.end();
    }

    writeObject(obj: ObjectDoodad) {
        let flags = 0;

        // this.script.write(`gv__o[${this.oc}].lv_kind = "${obj.kind}";\n`);
        this.script.write(`gv__o[${this.oc}].lv_type = "${obj.Type}";\n`);

        const pos = obj.Position.split(',');
        this.script.write(`gv__o[${this.oc}].lv_x = ${pos[0]};\n`);
        this.script.write(`gv__o[${this.oc}].lv_y = ${pos[1]};\n`);
        this.script.write(`gv__o[${this.oc}].lv_z = ${pos[2]};\n`);

        if (obj.Variation) {
            this.script.write(`gv__o[${this.oc}].lv_variation = ${obj.Variation};\n`);
            flags |= ObjectWriterFlags.ContainsModelVariation;
        }

        if (obj.Scale) {
            const scaleArgs = obj.Scale.split(',');
            this.script.write(`gv__o[${this.oc}].lv_scale_x = ${scaleArgs[0]};\n`);
            this.script.write(`gv__o[${this.oc}].lv_scale_y = ${scaleArgs[1]};\n`);
            this.script.write(`gv__o[${this.oc}].lv_scale_z = ${scaleArgs[2]};\n`);
            flags |= ObjectWriterFlags.ContainsScale;
        }

        if (obj.Rotation) {
            this.script.write(`gv__o[${this.oc}].lv_yaw = ${radiansToDegrees(parseFloat(obj.Rotation)).toPrecision(8)};\n`);
            flags |= ObjectWriterFlags.ContainsRotation;
        }
        if (obj.Pitch) {
            this.script.write(`gv__o[${this.oc}].lv_pitch = ${radiansToDegrees(parseFloat(obj.Pitch)).toPrecision(8)};\n`);
            flags |= ObjectWriterFlags.ContainsYPR;
        }
        if (obj.Roll) {
            this.script.write(`gv__o[${this.oc}].lv_roll = ${radiansToDegrees(parseFloat(obj.Roll)).toPrecision(8)};\n`);
            flags |= ObjectWriterFlags.ContainsYPR;
        }

        if (obj.TintColor) {
            const tintArgs = obj.TintColor.split(' ');
            const tintComponents = tintArgs[0].split(',').map((value) => parseFloat(value) / 2.5);
            this.script.write(`gv__o[${this.oc}].lv_tint_col = Color(${tintComponents.join(',')});\n`);
            this.script.write(`gv__o[${this.oc}].lv_tint_hdr = ${tintArgs[1]};\n`);
            flags |= ObjectWriterFlags.ContainsTint;
        }

        if (obj.TeamColor) {
            this.script.write(`gv__o[${this.oc}].lv_teamc = ${obj.TeamColor};\n`);
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
        if (flags !== 0) {
            this.script.write(`gv__o[${this.oc}].lv_flags = 0x${flags.toString(16)};\n`);
        }

        ++this.oc;
    }
}

export class ObjectsParser extends sax.SAXParser {
    protected objWriter: ObjectsGalaxyWriter;
    protected currentObject?: ObjectDoodad = null;

    constructor(objWriter: ObjectsGalaxyWriter) {
        super(true, {
        });
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
        this.objWriter.writeObject(this.currentObject);
        this.currentObject = null;
    }
}
