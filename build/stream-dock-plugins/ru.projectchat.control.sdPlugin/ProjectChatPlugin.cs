using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class ProjectChatPlugin
{
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    private static readonly Dictionary<string, string> Actions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { "ru.projectchat.control.start", "start" },
        { "ru.projectchat.control.finish", "finish" },
        { "ru.projectchat.control.toggle-output", "toggle-output" },
        { "ru.projectchat.control.extend", "extend" },
        { "ru.projectchat.control.next-preset", "next-preset" }
    };

    public static int Main(string[] args)
    {
        try
        {
            Run(args).GetAwaiter().GetResult();
            return 0;
        }
        catch (Exception error)
        {
            try { File.AppendAllText("projectchat-plugin.log", DateTime.UtcNow.ToString("O") + "  " + error + Environment.NewLine); }
            catch { }
            return 1;
        }
    }

    private static async Task Run(string[] args)
    {
        Dictionary<string, string> options = ParseArguments(args);
        string port;
        string pluginUuid;
        string registerEvent;
        if (!options.TryGetValue("-port", out port) ||
            !options.TryGetValue("-pluginUUID", out pluginUuid) ||
            !options.TryGetValue("-registerEvent", out registerEvent))
        {
            throw new InvalidDataException("Stream Dock не передал параметры регистрации плагина.");
        }

        using (ClientWebSocket socket = new ClientWebSocket())
        {
            await socket.ConnectAsync(new Uri("ws://127.0.0.1:" + port), CancellationToken.None);
            await Send(socket, new Dictionary<string, object>
            {
                { "event", registerEvent },
                { "uuid", pluginUuid }
            });

            byte[] buffer = new byte[16384];
            while (socket.State == WebSocketState.Open)
            {
                using (MemoryStream message = new MemoryStream())
                {
                    WebSocketReceiveResult result;
                    do
                    {
                        result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                        if (result.MessageType == WebSocketMessageType.Close) return;
                        message.Write(buffer, 0, result.Count);
                    }
                    while (!result.EndOfMessage);

                    if (result.MessageType != WebSocketMessageType.Text) continue;
                    string text = Encoding.UTF8.GetString(message.ToArray());
                    Dictionary<string, object> payload;
                    try { payload = Json.Deserialize<Dictionary<string, object>>(text); }
                    catch { continue; }
                    object eventName;
                    object actionName;
                    object context;
                    if (!payload.TryGetValue("event", out eventName) || Convert.ToString(eventName) != "keyDown" ||
                        !payload.TryGetValue("action", out actionName) || !payload.TryGetValue("context", out context)) continue;
                    string action;
                    if (!Actions.TryGetValue(Convert.ToString(actionName), out action)) continue;
                    bool succeeded = await Task.Run(() => InvokeProjectChat(action));
                    await Send(socket, new Dictionary<string, object>
                    {
                        { "event", succeeded ? "showOk" : "showAlert" },
                        { "context", Convert.ToString(context) }
                    });
                }
            }
        }
    }

    private static Dictionary<string, string> ParseArguments(string[] args)
    {
        Dictionary<string, string> result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int index = 0; index + 1 < args.Length; index += 2) result[args[index]] = args[index + 1];
        return result;
    }

    private static bool InvokeProjectChat(string action)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:4317/api/stream-dock");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers["X-projectCHAT-Control"] = "stream-dock-v1";
            request.Timeout = 2500;
            request.ReadWriteTimeout = 2500;
            byte[] body = Encoding.UTF8.GetBytes(Json.Serialize(new Dictionary<string, string> { { "action", action } }));
            request.ContentLength = body.Length;
            using (Stream stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse()) return response.StatusCode == HttpStatusCode.OK;
        }
        catch { return false; }
    }

    private static Task Send(ClientWebSocket socket, Dictionary<string, object> payload)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(payload));
        return socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
