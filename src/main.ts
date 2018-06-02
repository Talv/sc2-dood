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
    TileSet?: string;
    TintColor?: string;
    TeamColor?: string;
    Flag: ObjectFlags[];
}

const enum ObjectWriterFlags {
    HeightOffset = 1 << 0,
}

export class ObjectsGalaxyWriter {
    protected script: fs.WriteStream;
    oc: number;

    open(stream: fs.WriteStream) {
        this.script = stream;
    }

    start() {
        this.oc = 0;
        this.script.write(`void gf__ofill() {\n`);
    }

    close() {
        this.script.write(`gv__oc = ${this.oc};\n`);
        this.script.write(`}\n`);
        this.script.end();
    }

    writeObject(obj: ObjectDoodad) {
        // this.script.write(`gv__o[${this.oc}].lv_kind = "${obj.kind}";\n`);
        this.script.write(`gv__o[${this.oc}].lv_type = "${obj.Type}";\n`);

        const pos = obj.Position.split(',');
        this.script.write(`gv__o[${this.oc}].lv_pos = Point(${pos[0]},${pos[1]});\n`);
        if (pos[2] && pos[2] != '0') this.script.write(`gv__o[${this.oc}].lv_height = ${pos[2]};\n`);

        if (obj.Scale) this.script.write(`gv__o[${this.oc}].lv_scale = "${obj.Scale}";\n`);
        if (obj.Rotation) this.script.write(`gv__o[${this.oc}].lv_rotation = ${obj.Rotation};\n`);
        if (obj.Pitch) this.script.write(`gv__o[${this.oc}].lv_pitch = ${obj.Pitch};\n`);
        if (obj.Roll) this.script.write(`gv__o[${this.oc}].lv_roll = ${obj.Roll};\n`);
        if (obj.Variation) this.script.write(`gv__o[${this.oc}].lv_variation = ${obj.Variation};\n`);
        if (obj.TintColor) this.script.write(`gv__o[${this.oc}].lv_tintc = "${obj.TintColor}";\n`);
        if (obj.TeamColor) this.script.write(`gv__o[${this.oc}].lv_teamc = ${obj.TeamColor};\n`);

        let flags = 0;
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
