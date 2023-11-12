
import { Sequelize } from "sequelize";
import { connectDB as connectSequiz, close as closeSequiz } from './sequiz.mjs'
import EventEmitter from 'events'
class MessagesEmitter extends EventEmitter {}
export const emitter = new MessagesEmitter()

import { default as DBG } from 'debug'

export const debug = DBG('notes:model-messages')
export const error = DBG('notes:error-messages')

let sequelize;
export class SQMessage extends Sequelize.Model {}

async function connectDB() {
    if (sequelize) return;
    sequelize = await connectSequiz()

    SQMessage.init({
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        from: Sequelize.INTEGER,
        deleteok: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        namespace: Sequelize.STRING,
        room: Sequelize.STRING,
        message: Sequelize.STRING(1024),
        timestamp: Sequelize.DATE
    }, {
        hooks: {
            afterCreate: (message, options) => {
                const toEmit = sanitizedMessage(message);
                emitter.emit('newmessage', toEmit);
            },
            afterDestroy: (message, options) => {
                emitter.emit('destroymessage', {
                    id: message.id,
                    namespace: message.namespace,
                    room: message.room
                })
            }
        },
        sequelize,
        modelName: 'SQMessage'
    });
    await SQMessage.sync();
}

function sanitizedMessage(msg) {
    return {
        id: msg.id,
        from: msg.from,
        deleteok: msg.deleteok,
        namespace: msg.namespace,
        room: msg.room,
        message: msg.message,
        timestamp: msg.timestamp
    };
}

export async function postMessage(from, deleteok, namespace, room, message) {
    await connectDB();
    const newmsg = await SQMessage.create({
        from, deleteok, namespace, room, message, timestamp: new Date()
    })
}

export async function destroyMessage(id) {
    await connectDB();
    const msg = await SQMessage.findOne({ where: {id}} );
    if (msg) { msg.destroy() };
}

export async function recentMessages(namespace, room) {
    await connectDB();
    const messages = await SQMessage.findAll({
        where : { namespace, room },
        order: [ ['timestamp', 'DESC'] ],
        limit: 20
    });
    const msgs = messages.map(message => {
        return sanitizedMessage(message);
    })
    return (msgs && msgs.length >= 1) ? msgs : undefined;
}