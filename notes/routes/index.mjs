
import { default as express } from 'express'
import { NotesStore as notes } from '../models/notes-store.mjs'
import { twitterLogin } from './users.mjs'
import { io } from '../app.mjs'
import { default as DBG } from 'debug'

export const router = express.Router()

export const debug = DBG('notes:debug')
export const error = DBG('notes:error')

/* GET home page. */
router.get('/', async(req, res, next) => {
  try {
    const notelist = await getKeyTitlesList();
    //console.log('notelist: ',notelist)
    res.render('index', { atitle: 'Notes', notelist: notelist, 
                user: req.user ? req.user : undefined,
                twitterLogin: twitterLogin });
  } catch (err) { next(err) }
});

async function getKeyTitlesList() {
  const keylist = await notes.keylist()
  const keyPromises = keylist.map(key => {
    return notes.read(key)
  })
  const notelist = await Promise.all(keyPromises);
  return notelist.map(note => {
    return { key: note.key, title: note.title }
  })
}

export const emitNoteTitles = async() => {
  const notelist = await getKeyTitlesList();
  io.of('/home').emit('notetitles', { notelist });
}

export function init() {
  io.of('/home').on('connect', socket => {
    debug('socketio connection on /home')
  })
  notes.on('notecreated', emitNoteTitles);
  notes.on('noteupdated', emitNoteTitles);
  notes.on('notedestroyed', emitNoteTitles);
}