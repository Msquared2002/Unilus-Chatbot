"""Windows CurrentUser DPAPI. Input/output are pipes, never plaintext files/logs."""
import ctypes
import ctypes.wintypes as w
import sys

class Blob(ctypes.Structure):
    _fields_ = [('size', w.DWORD), ('data', ctypes.POINTER(ctypes.c_byte))]

def main():
    raw = sys.stdin.buffer.read()
    memory = ctypes.create_string_buffer(raw)
    source = Blob(len(raw), ctypes.cast(memory, ctypes.POINTER(ctypes.c_byte)))
    destination = Blob()
    crypt = ctypes.WinDLL('crypt32.dll')
    kernel = ctypes.WinDLL('kernel32.dll')
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    if sys.argv[1] == 'protect':
        ok = crypt.CryptProtectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(destination))
    elif sys.argv[1] == 'unprotect':
        ok = crypt.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(destination))
    else:
        raise ValueError('mode')
    if not ok:
        raise RuntimeError('DPAPI failed')
    try:
        sys.stdout.buffer.write(ctypes.string_at(destination.data, destination.size))
    finally:
        kernel.LocalFree(destination.data)

if __name__ == '__main__':
    try:
        main()
    except Exception:
        sys.stderr.write('Private backup protection failed\n')
        sys.exit(1)
