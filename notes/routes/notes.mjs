
import { default as express, query } from 'express'
import { NotesStore as notes } from '../models/notes-store.mjs'
import { ensureAuthenticated } from './users.mjs'
import { twitterLogin } from './users.mjs'
import { emitNoteTitles } from './index.mjs'
import { io } from '../app.mjs'
import { postMessage, destroyMessage, recentMessages, emitter as msgEvents } from '../models/messages-sequelize.mjs'
import * as util from 'util';

import DBG from 'debug'
export const debug = DBG('notes:home')
export const error = DBG('notes:error-home')

export const router = express.Router()

router.get('/add', ensureAuthenticated, (req,res,next) => {
    res.render('noteedit', {
        atitle : "Add a Note",
        docreate: true,
        notekey: '',
        user: req.user,
        note: undefined,
        twitterLogin: twitterLogin
    })
})

router.post('/save', ensureAuthenticated, async(req,res,next) => {
    try {
        let note;
        if (req.body.docreate === 'create') {
            note = await notes.create(req.body.notekey,req.body.title, req.body.body)
        } else {
            note = await notes.update(req.body.notekey,req.body.title, req.body.body)
        }
        res.redirect('/notes/view?key='+req.body.notekey)
    } catch (err) { next(err) }
});

router.get('/view', async(req,res,next) =>{
    try {
        let note = await notes.read(req.query.key)
        const messages = await recentMessages('/notes', req.query.key)
        if ( req.user && messages !== undefined ) {
            messages.forEach( message => {
                if ( message.from === req.user.id ) {
                    message.deleteok = true
                } else {
                    message.deleteok = false
                }
            })
        }
        res.render('noteview', {
            atitle: "Notes",
            title: note ? note.title : "",
            notekey: req.query.key, 
            user: req.user ? req.user : undefined, 
            note: note, messages,
            twitterLogin: twitterLogin
        });
    }  catch (err) { next(err) }
})

router.get('/edit', ensureAuthenticated, async(req,res,next) => {
    try {
        const note = await notes.read(req.query.key);
        if (req.user.givenName.slice(-6) === '-admin') {
            res.render('noteedit', {
                atitle: note ? ("Edit " + note.title) : "Add a Note",
                docreate: false,
                notekey: req.query.key,
                user: req.user,
                note: note,
                twitterLogin: twitterLogin
        })} else { next( res.redirect('/')) }
    } catch (err) { next(err) }
})

router.get('/destroy', ensureAuthenticated, async(req,res,next) => {
    try {
        const note = await notes.read(req.query.key);
        if (req.user.givenName.slice(-6) === '-admin') {
            res.render('notedestroy', {
                title: note ? note.title : "",
                notekey: req.query.key,
                user: req.user,
                note: note,
                twitterLogin: twitterLogin
        })} else { next( res.redirect('/')) }
    } catch (err) { next(err) }
})

router.post('/destroy/confirm', ensureAuthenticated, async(req,res,next) => {
    try {
        if (req.user.givenName.slice(-6) === '-admin') {
           await notes.destroy(req.body.notekey);
           res.redirect('/');} else { next( res.redirect('/')) }
    } catch (err) { next(err) }
})

export function init() {
    notes.on('noteupdated', note => {
      const toemit = {
        key: note.key, title: note.title, body: note.body
      }
      io.of('/notes').to(note.key).emit('noteupdated', toemit);
      emitNoteTitles();
    })
    notes.on('notedestroyed', key => {
      io.of('/notes').to(key).emit('notedestroyed', key);
      emitNoteTitles();
    })
}