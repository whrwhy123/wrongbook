# -*- coding: utf-8 -*-
"""错题本本地服务：电脑上运行，手机连同一 WiFi 即可访问"""
import os
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


def get_lan_ip():
    """获取本机局域网 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    class Handler(SimpleHTTPRequestHandler):
        def end_headers(self):
            # 禁止缓存，保证更新代码后刷新即生效
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()

        def log_message(self, fmt, *args):
            pass  # 安静模式，不刷屏

    try:
        httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    except OSError:
        print(f"[错误] 端口 {PORT} 被占用，请关闭占用该端口的程序后重试。")
        sys.exit(1)

    ip = get_lan_ip()
    print("=" * 46)
    print("       考编 · 高中政治错题本 已启动")
    print("=" * 46)
    print(f"  电脑访问:  http://localhost:{PORT}")
    print(f"  手机访问:  http://{ip}:{PORT}")
    print("")
    print("  手机要求:  与电脑连接【同一个 WiFi】")
    print("  添加到主屏幕: 手机浏览器菜单 -> 添加到主屏幕")
    print("  关闭服务:  直接关闭本窗口")
    print("=" * 46)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已关闭。")


if __name__ == "__main__":
    main()
