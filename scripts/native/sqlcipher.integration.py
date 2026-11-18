"""Real SQLCipher 4.20 desktop-engine tests; NOT Android/Keychain certification.
SQLCIPHER_LIBRARY=/absolute/libsqlcipher.so python3 scripts/native/sqlcipher.integration.py
Keys exist only in process memory; no key arguments, SQL trace or content logging.
"""
import ctypes as C
import hashlib
import json
import multiprocessing as MP
import os
from pathlib import Path
import tempfile
import unittest

LIBRARY = os.environ.get('SQLCIPHER_LIBRARY')
if not LIBRARY or not Path(LIBRARY).is_file():
    raise SystemExit('SQLCIPHER_LIBRARY must name a built SQLCipher 4.20 shared library; tests not executed.')
L = C.CDLL(LIBRARY)
L.sqlite3_open_v2.argtypes = [C.c_char_p,C.POINTER(C.c_void_p),C.c_int,C.c_char_p]
L.sqlite3_key.argtypes = [C.c_void_p,C.c_void_p,C.c_int]
CALLBACK = C.CFUNCTYPE(C.c_int,C.c_void_p,C.c_int,C.POINTER(C.c_char_p),C.POINTER(C.c_char_p))
L.sqlite3_exec.argtypes = [C.c_void_p,C.c_char_p,CALLBACK,C.c_void_p,C.POINTER(C.c_char_p)]
L.sqlite3_free.argtypes = [C.c_void_p]
L.sqlite3_close.argtypes = [C.c_void_p]
ROOT = Path(__file__).resolve().parents[2]
SCHEMA = (ROOT/'native/secure-vault/protocol/schema.sql').read_text()
SQL = json.loads((ROOT/'native/secure-vault/protocol/statements.json').read_text())

def quote(value):
    return 'NULL' if value is None else "'"+str(value).replace("'", "''")+"'"
def statement(name, args=()):
    pieces = SQL[name].split('?')
    assert len(pieces) == len(args)+1
    return ''.join(piece+(quote(args[i]) if i<len(args) else '') for i,piece in enumerate(pieces))
class DB:
    def __init__(self,path,key,initialize=False):
        self.handle=C.c_void_p()
        if L.sqlite3_open_v2(os.fsencode(path),C.byref(self.handle),2|(4 if initialize else 0),None): raise RuntimeError('OPEN')
        buffer=C.create_string_buffer(key)
        if L.sqlite3_key(self.handle,buffer,len(key)): self.close(); raise RuntimeError('KEY')
        C.memset(buffer,0,len(buffer))
        try:
            if not self.exec('PRAGMA cipher_version')[0][0].startswith('4.20.0'): raise RuntimeError('VERSION')
            self.exec('PRAGMA cipher_log_level=NONE; PRAGMA synchronous=EXTRA; PRAGMA journal_mode=DELETE; PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=5000; PRAGMA cipher_memory_security=ON')
            self.exec('SELECT count(*) FROM sqlite_master')
            if initialize:self.exec(SCHEMA)
        except Exception:self.close();raise
    def exec(self,sql):
        rows=[]
        @CALLBACK
        def row(_,n,values,names):
            rows.append(tuple(values[i].decode() if values[i] is not None else None for i in range(n)));return 0
        error=C.c_char_p()
        code=L.sqlite3_exec(self.handle,sql.encode(),row,None,C.byref(error))
        if error:L.sqlite3_free(error)
        if code:raise RuntimeError('SQLITE_'+str(code))
        return rows
    def close(self):
        if self.handle:L.sqlite3_close(self.handle);self.handle=None
    def __enter__(self):return self
    def __exit__(self,*_):self.close()
def write(db,expected,revision,operation,fail=None):
    snapshot=json.dumps({'version':'3.5','revision':revision,'fixture':'FICTITIOUS_VAULT_MARKER','wallets':[]},separators=(',',':'))
    fingerprint=hashlib.sha256((operation+snapshot).encode()).hexdigest()
    db.exec('BEGIN IMMEDIATE')
    try:
        receipts=db.exec(statement('operation',[operation]))
        if receipts:
            if receipts[0][0]!=fingerprint:raise RuntimeError('REUSED_ID')
            db.exec('COMMIT');return receipts[0][1]
        head=db.exec(SQL['active'])
        if (head[0][0] if head else None)!=expected:raise RuntimeError('CONFLICT')
        if head:
            db.exec(statement('putPrevious',[head[0][1]]))
            db.exec(statement('putRecovery',['finanzas_pro_recovery_test_'+operation,head[0][1]]))
        if fail:fail(db)
        db.exec(statement('putActive',[revision,snapshot,hashlib.sha256(snapshot.encode()).hexdigest(),operation]))
        db.exec(statement('putOperation',[operation,fingerprint,'committed',revision]))
        db.exec('COMMIT');return 'committed'
    except Exception:
        try:db.exec('ROLLBACK')
        except RuntimeError:pass
        raise

def crash(path,key,after_commit):
    db=DB(path,key)
    if after_commit:write(db,'r1','r2','crash2')
    else:write(db,'r1','r2','crash2',lambda _:os._exit(77))
    os._exit(78)
def race(path,key,revision,gate,output):
    try:
        with DB(path,key) as db:
            gate.wait();output.put(write(db,'r1',revision,revision))
    except RuntimeError as error:output.put(str(error))

class CipherIntegrity(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='finanzas-fictitious-cipher-');self.path=Path(self.temp.name)/'vault.db';self.key=os.urandom(32)
        with DB(self.path,self.key,True) as db:write(db,None,'r1','initial')
    def tearDown(self):self.temp.cleanup()
    def test_encrypted_header_and_no_plaintext(self):
        raw=self.path.read_bytes();self.assertNotEqual(raw[:16],b'SQLite format 3\0');self.assertNotIn(b'FICTITIOUS_VAULT_MARKER',raw)
    def test_uncommitted_database_and_journal_have_no_plaintext(self):
        with DB(self.path,self.key) as db:
            before=db.exec(SQL['active'])
            db.exec('BEGIN IMMEDIATE')
            try:
                db.exec("UPDATE active SET snapshot=snapshot || 'UNCOMMITTED_PRIVATE_MARKER'")
                for owned in self.path.parent.iterdir():
                    if owned.is_file():
                        raw=owned.read_bytes();self.assertNotIn(b'FICTITIOUS_VAULT_MARKER',raw);self.assertNotIn(b'UNCOMMITTED_PRIVATE_MARKER',raw)
            finally:db.exec('ROLLBACK')
            self.assertEqual(db.exec(SQL['active']),before)
    def test_wrong_key_preserves_ciphertext(self):
        before=self.path.read_bytes()
        with self.assertRaises(RuntimeError):DB(self.path,os.urandom(32))
        self.assertEqual(before,self.path.read_bytes())
    def test_integrity_and_extra_sync(self):
        with DB(self.path,self.key) as db:
            self.assertEqual(db.exec('PRAGMA quick_check'),[('ok',)])
            self.assertEqual(db.exec('PRAGMA cipher_integrity_check'),[])
            self.assertEqual(db.exec('PRAGMA synchronous'),[('3',)])
    def test_ciphertext_tamper_detected_and_preserved(self):
        raw=bytearray(self.path.read_bytes());raw[512]^=1;self.path.write_bytes(raw);before=bytes(raw)
        with self.assertRaises(RuntimeError):DB(self.path,self.key)
        self.assertEqual(self.path.read_bytes(),before)
    def test_atomic_recovery_and_rollback(self):
        with DB(self.path,self.key) as db:
            before=db.exec(SQL['active'])
            with self.assertRaisesRegex(RuntimeError,'INJECTED'):write(db,'r1','r2','rollback',lambda _:(_ for _ in ()).throw(RuntimeError('INJECTED')))
            self.assertEqual(db.exec(SQL['active']),before);self.assertEqual(db.exec(SQL['recoveries']),[])
            write(db,'r1','r2','new');self.assertEqual(db.exec(SQL['recoveries'])[0][1],before[0][1])
    def test_process_killed_before_commit(self):
        child=MP.Process(target=crash,args=(self.path,self.key,False));child.start();child.join(10);self.assertEqual(child.exitcode,77)
        with DB(self.path,self.key) as db:self.assertEqual(db.exec(SQL['active'])[0][0],'r1');self.assertEqual(db.exec(SQL['recoveries']),[])
    def test_process_killed_after_commit_receipt_survives(self):
        child=MP.Process(target=crash,args=(self.path,self.key,True));child.start();child.join(10);self.assertEqual(child.exitcode,78)
        with DB(self.path,self.key) as db:
            self.assertEqual(db.exec(SQL['active'])[0][0],'r2');self.assertEqual(write(db,'r1','r2','crash2'),'committed');self.assertEqual(len(db.exec(SQL['recoveries'])),1)
    def test_cross_process_cas_single_winner(self):
        gate=MP.Event();output=MP.Queue();children=[MP.Process(target=race,args=(self.path,self.key,r,gate,output)) for r in ['r2a','r2b']]
        for child in children:child.start()
        gate.set()
        for child in children:child.join(15);self.assertEqual(child.exitcode,0)
        self.assertCountEqual([output.get(timeout=1),output.get(timeout=1)],['committed','CONFLICT'])
    def test_disk_full_rolls_back(self):
        with DB(self.path,self.key) as db:
            pages=db.exec('PRAGMA page_count')[0][0];db.exec('PRAGMA max_page_count='+pages);before=db.exec(SQL['active'])
            with self.assertRaisesRegex(RuntimeError,'SQLITE_13'):
                db.exec('BEGIN IMMEDIATE')
                try:db.exec("INSERT INTO recoveries VALUES ('oversized',zeroblob(2000000))");db.exec('COMMIT')
                finally:
                    try:db.exec('ROLLBACK')
                    except RuntimeError:pass
            self.assertEqual(db.exec(SQL['active']),before)
    def test_future_schema_is_visible_and_not_recreated(self):
        with DB(self.path,self.key) as db:db.exec('PRAGMA user_version=999')
        with DB(self.path,self.key) as db:self.assertEqual(db.exec('PRAGMA user_version'),[('999',)]);self.assertEqual(db.exec(SQL['active'])[0][0],'r1')

if __name__=='__main__':unittest.main(verbosity=2)
