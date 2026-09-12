using System;
using System.Collections;
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
        { "ru.projectchat.control.toggle-poll", "toggle-poll" },
        { "ru.projectchat.control.select-preset", "select-preset" },
        { "ru.projectchat.control.toggle-output", "toggle-output" },
        { "ru.projectchat.control.extend", "extend" },

        // Keep commands from older layouts working after the plugin update.
        { "ru.projectchat.control.start", "start" },
        { "ru.projectchat.control.finish", "finish" },
        { "ru.projectchat.control.next-preset", "next-preset" }
    };

    private sealed class ProjectChatResult
    {
        public bool Succeeded;
        public bool PollRunning;
    }

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
                Dictionary<string, object> message = await Receive(socket, buffer);
                if (message == null) return;

                string eventName = StringValue(message, "event");
                string actionUuid = StringValue(message, "action");
                string context = StringValue(message, "context");

                if (eventName == "keyDown")
                {
                    string action;
                    if (!Actions.TryGetValue(actionUuid, out action) || String.IsNullOrEmpty(context)) continue;
                    Dictionary<string, object> settings = SettingsFrom(message);
                    string presetId = StringValue(settings, "presetId");
                    if (action == "select-preset" && String.IsNullOrEmpty(presetId))
                    {
                        await Feedback(socket, context, false);
                        continue;
                    }

                    ProjectChatResult result = await Task.Run(() => InvokeProjectChat(action, presetId));
                    await Feedback(socket, context, result.Succeeded);
                    if (result.Succeeded && action == "toggle-poll")
                        await SetState(socket, context, result.PollRunning ? 1 : 0);
                }
                else if (eventName == "willAppear")
                {
                    if (actionUuid == "ru.projectchat.control.toggle-poll" && !String.IsNullOrEmpty(context))
                    {
                        Dictionary<string, object> state = await Task.Run(() => ReadState());
                        if (state != null) await SetState(socket, context, PollRunning(state) ? 1 : 0);
                    }
                    else if (actionUuid == "ru.projectchat.control.select-preset" && !String.IsNullOrEmpty(context))
                    {
                        await SetTitle(socket, context, StringValue(SettingsFrom(message), "presetName"));
                    }
                }
                else if (eventName == "didReceiveSettings" && actionUuid == "ru.projectchat.control.select-preset")
                {
                    if (!String.IsNullOrEmpty(context))
                        await SetTitle(socket, context, StringValue(SettingsFrom(message), "presetName"));
                }
                else if (eventName == "sendToPlugin" && actionUuid == "ru.projectchat.control.select-preset")
                {
                    Dictionary<string, object> state = await Task.Run(() => ReadState());
                    await Send(socket, new Dictionary<string, object>
                    {
                        { "event", "sendToPropertyInspector" },
                        { "context", context },
                        { "payload", new Dictionary<string, object>
                            {
                                { "event", "presets" },
                                { "presets", PresetSummaries(state) }
                            }
                        }
                    });
                }
            }
        }
    }

    private static async Task<Dictionary<string, object>> Receive(ClientWebSocket socket, byte[] buffer)
    {
        using (MemoryStream message = new MemoryStream())
        {
            WebSocketReceiveResult result;
            do
            {
                result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close) return null;
                message.Write(buffer, 0, result.Count);
            }
            while (!result.EndOfMessage);

            if (result.MessageType != WebSocketMessageType.Text) return new Dictionary<string, object>();
            try { return Json.Deserialize<Dictionary<string, object>>(Encoding.UTF8.GetString(message.ToArray())); }
            catch { return new Dictionary<string, object>(); }
        }
    }

    private static Dictionary<string, string> ParseArguments(string[] args)
    {
        Dictionary<string, string> result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int index = 0; index + 1 < args.Length; index += 2) result[args[index]] = args[index + 1];
        return result;
    }

    private static Dictionary<string, object> DictionaryValue(Dictionary<string, object> source, string key)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) ? value as Dictionary<string, object> : null;
    }

    private static string StringValue(Dictionary<string, object> source, string key)
    {
        object value;
        return source != null && source.TryGetValue(key, out value) ? Convert.ToString(value) : String.Empty;
    }

    private static Dictionary<string, object> SettingsFrom(Dictionary<string, object> message)
    {
        return DictionaryValue(DictionaryValue(message, "payload"), "settings") ?? new Dictionary<string, object>();
    }

    private static ProjectChatResult InvokeProjectChat(string action, string presetId)
    {
        ProjectChatResult result = new ProjectChatResult();
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:4317/api/stream-dock");
            request.Method = "POST";
            request.ContentType = "application/json";
            request.Headers["X-projectCHAT-Control"] = "stream-dock-v1";
            request.Timeout = 2500;
            request.ReadWriteTimeout = 2500;
            Dictionary<string, object> command = new Dictionary<string, object> { { "action", action } };
            if (!String.IsNullOrEmpty(presetId)) command["presetId"] = presetId;
            byte[] body = Encoding.UTF8.GetBytes(Json.Serialize(command));
            request.ContentLength = body.Length;
            using (Stream stream = request.GetRequestStream()) stream.Write(body, 0, body.Length);
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
            {
                Dictionary<string, object> payload = Json.Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
                result.Succeeded = response.StatusCode == HttpStatusCode.OK;
                result.PollRunning = PollRunning(DictionaryValue(payload, "state"));
            }
        }
        catch { }
        return result;
    }

    private static Dictionary<string, object> ReadState()
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:4317/api/state");
            request.Method = "GET";
            request.Timeout = 2500;
            request.ReadWriteTimeout = 2500;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                return Json.Deserialize<Dictionary<string, object>>(reader.ReadToEnd());
        }
        catch { return null; }
    }

    private static bool PollRunning(Dictionary<string, object> state)
    {
        Dictionary<string, object> poll = DictionaryValue(state, "poll");
        return poll != null && StringValue(poll, "status") == "running";
    }

    private static List<object> PresetSummaries(Dictionary<string, object> state)
    {
        List<object> result = new List<object>();
        object value;
        IEnumerable presets = state != null && state.TryGetValue("presets", out value) ? value as IEnumerable : null;
        if (presets == null) return result;
        foreach (object entry in presets)
        {
            Dictionary<string, object> preset = entry as Dictionary<string, object>;
            string id = StringValue(preset, "id");
            string name = StringValue(preset, "name");
            if (!String.IsNullOrEmpty(id) && !String.IsNullOrEmpty(name))
                result.Add(new Dictionary<string, object> { { "id", id }, { "name", name } });
        }
        return result;
    }

    private static Task Feedback(ClientWebSocket socket, string context, bool succeeded)
    {
        return Send(socket, new Dictionary<string, object>
        {
            { "event", succeeded ? "showOk" : "showAlert" },
            { "context", context }
        });
    }

    private static Task SetState(ClientWebSocket socket, string context, int state)
    {
        return Send(socket, new Dictionary<string, object>
        {
            { "event", "setState" },
            { "context", context },
            { "payload", new Dictionary<string, object> { { "state", state } } }
        });
    }

    private static Task SetTitle(ClientWebSocket socket, string context, string title)
    {
        return Send(socket, new Dictionary<string, object>
        {
            { "event", "setTitle" },
            { "context", context },
            { "payload", new Dictionary<string, object>
                {
                    { "title", String.IsNullOrEmpty(title) ? "Шаблон" : title },
                    { "target", 0 }
                }
            }
        });
    }

    private static Task Send(ClientWebSocket socket, Dictionary<string, object> payload)
    {
        byte[] bytes = Encoding.UTF8.GetBytes(Json.Serialize(payload));
        return socket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
