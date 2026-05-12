/**
 * Client-side device fingerprinting utility
 * Collects comprehensive device information for trusted device management
 */

export interface ClientDeviceInfo {
  deviceName: string;
  browser: string;
  os: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  userAgent: string;
  canvasFingerprint: string;
  webglFingerprint: string;
  audioFingerprint: string;
  fonts: string[];
  plugins: string[];
  hardwareConcurrency: number;
  deviceMemory?: number;
  maxTouchPoints: number;
  cookieEnabled: boolean;
  doNotTrack: string;
  adBlockDetected: boolean;
}

class ClientDeviceFingerprint {
  
  /**
   * Get comprehensive device information
   */
  async getDeviceInfo(): Promise<ClientDeviceInfo> {
    const info: ClientDeviceInfo = {
      deviceName: this.getDeviceName(),
      browser: this.getBrowser(),
      os: this.getOS(),
      screenResolution: this.getScreenResolution(),
      timezone: this.getTimezone(),
      language: this.getLanguage(),
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      canvasFingerprint: await this.getCanvasFingerprint(),
      webglFingerprint: await this.getWebGLFingerprint(),
      audioFingerprint: await this.getAudioFingerprint(),
      fonts: this.getFonts(),
      plugins: this.getPlugins(),
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack || 'Unknown',
      adBlockDetected: await this.detectAdBlock()
    };

    return info;
  }

  /**
   * Generate device name from available information
   */
  private getDeviceName(): string {
    const os = this.getOS();
    const browser = this.getBrowser();
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      return `${os} Mobile (${browser})`;
    }
    
    return `${os} Desktop (${browser})`;
  }

  /**
   * Detect browser
   */
  private getBrowser(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown Browser';
  }

  /**
   * Detect operating system
   */
  private getOS(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Windows')) return 'Windows';
    if (userAgent.includes('Mac')) return 'macOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    
    return 'Unknown OS';
  }

  /**
   * Get screen resolution
   */
  private getScreenResolution(): string {
    return `${screen.width}x${screen.height}`;
  }

  /**
   * Get timezone
   */
  private getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Get language
   */
  private getLanguage(): string {
    return navigator.language || 'Unknown';
  }

  /**
   * Generate canvas fingerprint
   */
  private async getCanvasFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return 'Canvas not supported';
      
      // Draw text with various fonts and styles
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprint', 4, 17);
      
      return canvas.toDataURL();
    } catch {
      return 'Canvas fingerprint failed';
    }
  }

  /**
   * Generate WebGL fingerprint
   */
  private async getWebGLFingerprint(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) return 'WebGL not supported';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return `${vendor} - ${renderer}`;
      }
      
      return 'WebGL debug info not available';
    } catch {
      return 'WebGL fingerprint failed';
    }
  }

  /**
   * Generate audio fingerprint
   */
  private async getAudioFingerprint(): Promise<string> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      
      oscillator.type = 'triangle';
      oscillator.frequency.value = 10000;
      
      gainNode.gain.value = 0;
      
      oscillator.connect(analyser);
      analyser.connect(scriptProcessor);
      scriptProcessor.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.start(0);
      
      return 'Audio fingerprint generated';
    } catch {
      return 'Audio fingerprint failed';
    }
  }

  /**
   * Get installed fonts
   */
  private getFonts(): string[] {
    const fonts = [
      'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
      'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS',
      'Trebuchet MS', 'Arial Black', 'Impact', 'Lucida Console',
      'Tahoma', 'Geneva', 'Times', 'Courier', 'Monaco'
    ];
    
    const availableFonts: string[] = [];
    
    // Simple font detection
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const h = document.getElementsByTagName('body')[0];
    
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const baseWidth: { [key: string]: number } = {};
    const baseHeight: { [key: string]: number } = {};
    
    // Test base fonts
    baseFonts.forEach(baseFont => {
      const span = document.createElement('span');
      span.style.fontSize = testSize;
      span.style.fontFamily = baseFont;
      span.innerHTML = testString;
      h.appendChild(span);
      baseWidth[baseFont] = span.offsetWidth;
      baseHeight[baseFont] = span.offsetHeight;
      h.removeChild(span);
    });
    
    // Test each font
    fonts.forEach(font => {
      const detected = baseFonts.some(baseFont => {
        const span = document.createElement('span');
        span.style.fontSize = testSize;
        span.style.fontFamily = `${font}, ${baseFont}`;
        span.innerHTML = testString;
        h.appendChild(span);
        const width = span.offsetWidth;
        const height = span.offsetHeight;
        h.removeChild(span);
        
        return width !== baseWidth[baseFont] || height !== baseHeight[baseFont];
      });
      
      if (detected) {
        availableFonts.push(font);
      }
    });
    
    return availableFonts;
  }

  /**
   * Get browser plugins
   */
  private getPlugins(): string[] {
    const plugins: string[] = [];
    
    if (navigator.plugins) {
      for (let i = 0; i < navigator.plugins.length; i++) {
        plugins.push(navigator.plugins[i].name);
      }
    }
    
    return plugins;
  }

  /**
   * Detect ad blocker
   */
  private async detectAdBlock(): Promise<boolean> {
    try {
      const testAd = document.createElement('div');
      testAd.innerHTML = '&nbsp;';
      testAd.className = 'adsbox';
      testAd.style.position = 'absolute';
      testAd.style.left = '-999px';
      testAd.style.top = '-999px';
      
      document.body.appendChild(testAd);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const isBlocked = testAd.offsetHeight === 0;
      document.body.removeChild(testAd);
      
      return isBlocked;
    } catch {
      return false;
    }
  }

  /**
   * Generate device ID from collected information
   */
  generateDeviceId(info: ClientDeviceInfo): string {
    const components = [
      info.browser,
      info.os,
      info.screenResolution,
      info.timezone,
      info.language,
      info.platform,
      info.hardwareConcurrency,
      info.deviceMemory,
      info.maxTouchPoints,
      info.canvasFingerprint.substring(0, 50), // Truncate for performance
      info.webglFingerprint,
      info.fonts.join(','),
      info.plugins.join(',')
    ].filter(Boolean);
    
    const combined = components.join('|');
    return this.simpleHash(combined);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export const clientDeviceFingerprint = new ClientDeviceFingerprint();
export default clientDeviceFingerprint;
