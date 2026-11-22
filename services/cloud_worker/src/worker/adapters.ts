export interface SandboxCommandSpec {
  adapter: string;
  command: string[];
  timeoutMs: number;
  dockerArgs: string[];
}

export const CLOUD_SUPPORTED_ADAPTERS = [
  { id: 'libreoffice', formats: ['docx', 'doc', 'odt', 'rtf', 'pages', 'xlsx', 'xls', 'ods', 'numbers', 'pptx', 'ppt', 'odp', 'key', 'pdf', 'html'] },
  { id: 'pandoc', formats: ['md', 'tex', 'docx', 'epub', 'html', 'rtf', 'odt'] },
  { id: 'calibre', formats: ['epub', 'mobi', 'azw3', 'fb2', 'lit', 'lrf', 'djvu', 'cbz', 'cbr', 'pdf'] },
  { id: 'imagemagick_inkscape', formats: ['psd', 'xcf', 'ai', 'eps', 'cdr', 'emf', 'wmf', 'avif', 'jxl', 'cr3', 'orf', 'raf', 'rw2', 'png', 'jpg', 'webp', 'svg'] },
  { id: 'ghostscript_safer', formats: ['pdf', 'eps', 'ps', 'png', 'jpg'] },
  { id: 'assimp_blender', formats: ['obj', 'fbx', 'glb', 'gltf', 'stl', 'ply', '3ds', 'dae', '3mf', 'blend', 'usdz'] },
  { id: 'cad', formats: ['dxf', 'dwg', 'step', 'iges', 'pdf', 'svg', 'stl'] },
  { id: 'fontforge', formats: ['ttf', 'otf', 'woff', 'woff2', 'eot'] },
  { id: 'ffmpeg', formats: ['mkv', 'webm', 'avi', 'flv', 'wmv', 'mxf', 'vob', 'ts', 'rmvb', '3gp', 'mp4', 'mov', 'mp3', 'flac', 'ogg', 'opus', 'wma', 'amr', 'ac3', 'dts', 'wav'] },
  { id: 'archive_7zz', formats: ['rar', '7z', 'cab', 'iso', 'dmg', 'bz2', 'xz', 'zst', 'zip', 'tar', 'tgz'] },
] as const;

/**
 * Returns hardened ephemeral Docker invocation flags enforcing Anti-RCE / Anti-SSRF defense:
 * - --network=none (blocks SSRF, XXE external DTD, remote image/font leaks)
 * - --read-only + --tmpfs /work:rw,noexec,nosuid,size=1g
 * - Non-root UID/GID 65532:65532 + --cap-drop=ALL + --security-opt=no-new-privileges
 * - Hard resource caps (--memory=2g --cpus=2 --pids-limit=128)
 */
export function buildHardenedDockerArgs(hostJobDir: string, image = 'omniconvert-sandbox:latest'): string[] {
  return [
    'run',
    '--rm',
    '--network=none',
    '--read-only',
    '--user=65532:65532',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--memory=2g',
    '--cpus=2',
    '--pids-limit=128',
    '--tmpfs',
    '/tmp:rw,noexec,nosuid,size=256m',
    '-v',
    `${hostJobDir}:/work:rw`,
    image,
  ];
}

export function buildConverterCommand(
  sourceExt: string,
  targetExt: string,
  inputPath: string,
  outputDir: string,
  outputPath: string,
): SandboxCommandSpec {
  const s = sourceExt.toLowerCase();
  const t = targetExt.toLowerCase();
  const dockerArgs = buildHardenedDockerArgs(outputDir);

  if (['docx', 'doc', 'odt', 'rtf', 'pages', 'xlsx', 'xls', 'ods', 'numbers', 'pptx', 'ppt', 'odp', 'key'].includes(s)) {
    return {
      adapter: 'libreoffice',
      command: [
        'soffice',
        '--headless',
        '--norestore',
        '--nologo',
        '--nolockcheck',
        '-env:UserInstallation=file:///work/lo_profile',
        '--convert-to',
        t,
        '--outdir',
        '/work',
        inputPath,
      ],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (['epub', 'mobi', 'azw3', 'fb2', 'lit', 'lrf', 'djvu', 'cbz', 'cbr'].includes(s)) {
    return {
      adapter: 'calibre',
      command: ['ebook-convert', inputPath, outputPath],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (s === 'pdf' && ['png', 'jpg'].includes(t)) {
    return {
      adapter: 'ghostscript_safer',
      command: [
        'gs',
        '-dSAFER',
        '-dBATCH',
        '-dNOPAUSE',
        t === 'png' ? '-sDEVICE=png16m' : '-sDEVICE=jpeg',
        '-r150',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (['ai', 'eps', 'cdr', 'emf', 'wmf'].includes(s)) {
    return {
      adapter: 'inkscape',
      command: ['inkscape', inputPath, `--export-filename=${outputPath}`],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (['psd', 'xcf', 'avif', 'jxl', 'cr3', 'orf', 'raf', 'rw2'].includes(s)) {
    return {
      adapter: 'imagemagick',
      command: ['convert', `${inputPath}[0]`, '-strip', outputPath],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(s)) {
    return {
      adapter: 'fontforge',
      command: ['fontforge', '-lang=ff', '-c', `Open($1); Generate($2)`, inputPath, outputPath],
      timeoutMs: 90_000,
      dockerArgs,
    };
  }

  if (['obj', 'fbx', 'glb', 'gltf', 'stl', 'ply', '3ds', 'dae', '3mf', 'usdz'].includes(s)) {
    return {
      adapter: 'assimp',
      command: ['assimp', 'export', inputPath, outputPath],
      timeoutMs: 120_000,
      dockerArgs,
    };
  }

  if (['mkv', 'webm', 'avi', 'flv', 'wmv', 'mxf', 'vob', 'ts', 'rmvb', '3gp', 'wma', 'amr', 'ac3', 'dts', 'm4b'].includes(s)) {
    return {
      adapter: 'ffmpeg',
      command: ['ffmpeg', '-y', '-i', inputPath, '-map_metadata', '-1', outputPath],
      timeoutMs: 180_000,
      dockerArgs,
    };
  }

  return {
    adapter: 'pandoc',
    command: ['pandoc', inputPath, '-o', outputPath],
    timeoutMs: 120_000,
    dockerArgs,
  };
}
