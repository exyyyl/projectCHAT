using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

internal static class Program
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WH_MOUSE_LL = 14;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int WM_RBUTTONDOWN = 0x0204;
    private const int WM_RBUTTONUP = 0x0205;
    private const int WM_MBUTTONDOWN = 0x0207;
    private const int WM_MBUTTONUP = 0x0208;
    private const int WM_MOUSEWHEEL = 0x020A;
    private const int WM_XBUTTONDOWN = 0x020B;
    private const int WM_XBUTTONUP = 0x020C;
    private const uint LLKHF_INJECTED = 0x10;
    private const uint LLMHF_INJECTED = 0x01;

    private static readonly Dictionary<uint, string> Keys = new Dictionary<uint, string>
    {
        { 0x31, "1" }, { 0x32, "2" }, { 0x33, "3" }, { 0x34, "4" }, { 0x35, "5" }, { 0x36, "6" },
        { 0x41, "A" }, { 0x44, "D" }, { 0x45, "E" }, { 0x46, "F" }, { 0x51, "Q" }, { 0x52, "R" }, { 0x53, "S" }, { 0x57, "W" },
        { 0x10, "Shift" }, { 0xA0, "Shift" }, { 0xA1, "Shift" },
        { 0x11, "Ctrl" }, { 0xA2, "Ctrl" }, { 0xA3, "Ctrl" },
        { 0x12, "Alt" }, { 0xA4, "Alt" }, { 0xA5, "Alt" }, { 0x20, "Space" },
    };

    private delegate IntPtr HookProc(int code, IntPtr wParam, IntPtr lParam);
    private static readonly HookProc KeyboardProc = KeyboardHook;
    private static readonly HookProc MouseProc = MouseHook;
    private static IntPtr keyboardHook;
    private static IntPtr mouseHook;

    private static void Main()
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        using (Process process = Process.GetCurrentProcess())
        using (ProcessModule module = process.MainModule)
        {
            IntPtr handle = GetModuleHandle(module.ModuleName);
            keyboardHook = SetWindowsHookEx(WH_KEYBOARD_LL, KeyboardProc, handle, 0);
            mouseHook = SetWindowsHookEx(WH_MOUSE_LL, MouseProc, handle, 0);
        }
        if (keyboardHook == IntPtr.Zero || mouseHook == IntPtr.Zero)
        {
            Console.Error.WriteLine("Не удалось подключить системный захват ввода.");
            Environment.ExitCode = 1;
            return;
        }
        try
        {
            Message message;
            while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref message);
                DispatchMessage(ref message);
            }
        }
        finally
        {
            UnhookWindowsHookEx(keyboardHook);
            UnhookWindowsHookEx(mouseHook);
        }
    }

    private static IntPtr KeyboardHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            KeyboardData data = (KeyboardData)Marshal.PtrToStructure(lParam, typeof(KeyboardData));
            string key;
            if ((data.flags & LLKHF_INJECTED) == 0 && Keys.TryGetValue(data.vkCode, out key))
            {
                int message = wParam.ToInt32();
                if (message == WM_KEYDOWN || message == WM_SYSKEYDOWN) WriteKey(key, "down");
                else if (message == WM_KEYUP || message == WM_SYSKEYUP) WriteKey(key, "up");
            }
        }
        return CallNextHookEx(keyboardHook, code, wParam, lParam);
    }

    private static IntPtr MouseHook(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            MouseData data = (MouseData)Marshal.PtrToStructure(lParam, typeof(MouseData));
            if ((data.flags & LLMHF_INJECTED) == 0)
            {
                int message = wParam.ToInt32();
                if (message == WM_LBUTTONDOWN) WriteMouse("left", "down");
                else if (message == WM_LBUTTONUP) WriteMouse("left", "up");
                else if (message == WM_RBUTTONDOWN) WriteMouse("right", "down");
                else if (message == WM_RBUTTONUP) WriteMouse("right", "up");
                else if (message == WM_MBUTTONDOWN) WriteMouse("middle", "down");
                else if (message == WM_MBUTTONUP) WriteMouse("middle", "up");
                else if (message == WM_XBUTTONDOWN || message == WM_XBUTTONUP)
                {
                    string button = HighWord(data.mouseData) == 1 ? "back" : "forward";
                    WriteMouse(button, message == WM_XBUTTONDOWN ? "down" : "up");
                }
                else if (message == WM_MOUSEWHEEL)
                {
                    short delta = unchecked((short)HighWord(data.mouseData));
                    Console.WriteLine("{\"kind\":\"wheel\",\"direction\":\"" + (delta > 0 ? "up" : "down") + "\"}");
                }
            }
        }
        return CallNextHookEx(mouseHook, code, wParam, lParam);
    }

    private static ushort HighWord(uint value) { return (ushort)((value >> 16) & 0xffff); }
    private static void WriteKey(string code, string action) { Console.WriteLine("{\"kind\":\"key\",\"action\":\"" + action + "\",\"code\":\"" + code + "\"}"); }
    private static void WriteMouse(string button, string action) { Console.WriteLine("{\"kind\":\"mouse\",\"action\":\"" + action + "\",\"button\":\"" + button + "\"}"); }

    [StructLayout(LayoutKind.Sequential)]
    private struct KeyboardData { public uint vkCode, scanCode, flags, time; public UIntPtr extraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int x, y; }

    [StructLayout(LayoutKind.Sequential)]
    private struct MouseData { public Point point; public uint mouseData, flags, time; public UIntPtr extraInfo; }

    [StructLayout(LayoutKind.Sequential)]
    private struct Message { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public Point point; }

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int hook, HookProc callback, IntPtr module, uint threadId);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetMessage(out Message message, IntPtr window, uint min, uint max);
    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref Message message);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr DispatchMessage(ref Message message);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string moduleName);
}
