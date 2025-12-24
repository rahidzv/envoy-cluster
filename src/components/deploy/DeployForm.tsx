import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Plus, Trash2, Eye, EyeOff, FileCode, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useBots } from "@/hooks/useBots";

interface EnvVar {
  key: string;
  value: string;
  hidden: boolean;
}

type Platform = "telegram" | "discord";
type Runtime = "python" | "nodejs" | "php";

interface DeployFormProps {
  onSuccess?: () => void;
}

export const DeployForm = ({ onSuccess }: DeployFormProps) => {
  const [platform, setPlatform] = useState<Platform>("telegram");
  const [runtime, setRuntime] = useState<Runtime>("python");
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { key: "BOT_TOKEN", value: "", hidden: true }
  ]);
  const [botName, setBotName] = useState("");
  const [script, setScript] = useState("");
  const [deploying, setDeploying] = useState(false);
  
  const { createBot } = useBots();

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "", hidden: false }]);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const updateEnvVar = (index: number, field: keyof EnvVar, value: string | boolean) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVars(updated);
  };

  const handleDeploy = async () => {
    if (!botName.trim()) return;
    
    setDeploying(true);
    try {
      const envVarsToSave = envVars
        .filter(ev => ev.key && ev.value)
        .map(ev => ({ key: ev.key, value: ev.value }));
      
      const bot = await createBot(
        botName,
        platform,
        runtime,
        script || undefined,
        envVarsToSave
      );
      
      if (bot) {
        setBotName("");
        setScript("");
        setEnvVars([{ key: "BOT_TOKEN", value: "", hidden: true }]);
        onSuccess?.();
      }
    } finally {
      setDeploying(false);
    }
  };

  const platformOptions: { value: Platform; label: string; icon: string }[] = [
    { value: "telegram", label: "Telegram", icon: "https://cdn.simpleicons.org/telegram/26A5E4" },
    { value: "discord", label: "Discord", icon: "https://cdn.simpleicons.org/discord/5865F2" },
  ];

  const runtimeOptions: { value: Runtime; label: string; icon: string }[] = [
    { value: "python", label: "Python", icon: "https://cdn.simpleicons.org/python/3776AB" },
    { value: "nodejs", label: "Node.js", icon: "https://cdn.simpleicons.org/nodedotjs/339933" },
    { value: "php", label: "PHP", icon: "https://cdn.simpleicons.org/php/777BB4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-4 glow">
          <Zap className="w-8 h-8 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Deploy New Bot</h1>
        <p className="text-muted-foreground">
          Launch your bot in seconds with isolated container deployment
        </p>
      </div>

      <div className="space-y-6 bg-card border border-border rounded-xl p-6 card-shadow">
        {/* Bot Name */}
        <div className="space-y-2">
          <Label htmlFor="botName">Bot Name</Label>
          <Input
            id="botName"
            placeholder="My Awesome Bot"
            value={botName}
            onChange={(e) => setBotName(e.target.value)}
            className="bg-secondary border-border"
          />
        </div>

        {/* Platform Selection */}
        <div className="space-y-2">
          <Label>Platform</Label>
          <div className="grid grid-cols-2 gap-3">
            {platformOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPlatform(opt.value)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-lg border transition-all duration-200",
                  platform === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/50 hover:border-primary/50"
                )}
              >
                <img src={opt.icon} alt={opt.label} className="w-6 h-6" />
                <span className="font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Runtime Selection */}
        <div className="space-y-2">
          <Label>Runtime</Label>
          <div className="grid grid-cols-3 gap-3">
            {runtimeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRuntime(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all duration-200",
                  runtime === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-secondary/50 hover:border-primary/50"
                )}
              >
                <img src={opt.icon} alt={opt.label} className="w-8 h-8" />
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Environment Variables</Label>
            <Button variant="ghost" size="sm" onClick={addEnvVar}>
              <Plus className="w-4 h-4 mr-1" />
              Add Variable
            </Button>
          </div>
          <div className="space-y-2">
            {envVars.map((env, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  placeholder="KEY"
                  value={env.key}
                  onChange={(e) => updateEnvVar(index, "key", e.target.value)}
                  className="flex-1 bg-secondary border-border font-mono text-sm"
                />
                <div className="relative flex-1">
                  <Input
                    type={env.hidden ? "password" : "text"}
                    placeholder="value"
                    value={env.value}
                    onChange={(e) => updateEnvVar(index, "value", e.target.value)}
                    className="bg-secondary border-border font-mono text-sm pr-10"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={() => updateEnvVar(index, "hidden", !env.hidden)}
                  >
                    {env.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeEnvVar(index)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Script Upload */}
        <div className="space-y-2">
          <Label>Bot Script</Label>
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer bg-secondary/30">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag and drop your bot script here
            </p>
            <p className="text-xs text-muted-foreground/70">
              Supports .py, .js, .php files (max 5MB)
            </p>
          </div>
          <div className="text-center text-sm text-muted-foreground">or</div>
          <Textarea
            placeholder="Paste your bot code here..."
            value={script}
            onChange={(e) => setScript(e.target.value)}
            className="bg-secondary border-border font-mono text-sm min-h-32"
          />
        </div>

        {/* Resource Info */}
        <div className="bg-secondary/50 rounded-lg p-4 border border-border">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileCode className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground text-sm mb-1">Container Resources</h4>
              <p className="text-xs text-muted-foreground">
                Each bot runs in an isolated container with <span className="text-primary font-medium">50MB RAM</span> and <span className="text-primary font-medium">0.1 vCPU</span> limits. Network access is restricted for security.
              </p>
            </div>
          </div>
        </div>

        {/* Deploy Button */}
        <Button 
          variant="glow" 
          size="lg" 
          className="w-full" 
          onClick={handleDeploy}
          disabled={!botName.trim() || deploying}
        >
          {deploying ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Deploy Bot
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};
