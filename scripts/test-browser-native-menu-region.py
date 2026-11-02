"""检查测试进程浮层的 Win32 绘制区域，不触碰用户窗口。"""
import ctypes
from ctypes import wintypes as w
import json
import sys

request = json.loads(sys.argv[1])
u = ctypes.WinDLL("user32", use_last_error=True)
u.SetProcessDpiAwarenessContext.argtypes = [w.HANDLE]
u.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
g = ctypes.WinDLL("gdi32", use_last_error=True)
u.GetWindowThreadProcessId.argtypes = [w.HWND, ctypes.POINTER(w.DWORD)]
u.GetWindowRect.argtypes = [w.HWND, ctypes.POINTER(w.RECT)]
g.CreateRectRgn.restype = w.HANDLE
g.PtInRegion.argtypes = [w.HANDLE, ctypes.c_int, ctypes.c_int]
u.GetWindowRgn.argtypes = [w.HWND, w.HANDLE]
g.DeleteObject.argtypes = [w.HANDLE]
geometry, popup = request["geometry"], request["popup"]
result = None
@ctypes.WINFUNCTYPE(w.BOOL, w.HWND, w.LPARAM)
def inspect(hwnd, unused):
    global result
    pid = w.DWORD()
    u.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if pid.value != request["pid"]:
        return True
    rect = w.RECT()
    u.GetWindowRect(hwnd, ctypes.byref(rect))
    if abs(rect.left-geometry["position"]["x"])>2 or abs(rect.top-geometry["position"]["y"])>2:
        return True
    region = g.CreateRectRgn(0, 0, 0, 0)
    kind = u.GetWindowRgn(hwnd, region)
    scale = geometry["scale"]
    x,y,width,height = popup["x"],popup["y"],popup["w"],popup["h"]
    # 采样边中点，避开圆角本来不属于窗口的部分。
    points = [(x+1,y+height/2),(x+width-1,y+height/2),(x+width/2,y+1),(x+width/2,y+height-1)]
    covered = [bool(g.PtInRegion(region,round(px*scale),round(py*scale))) for px,py in points]
    result = {"kind":kind,"edges":covered,"covered":all(covered)}
    g.DeleteObject(region)
    return False
u.EnumWindows(inspect,0)
if result is None:
    raise RuntimeError("未找到测试菜单窗口")
print(json.dumps(result))
