import { NativeModules } from 'react-native';

const { ApkInstaller } = NativeModules as {
  ApkInstaller: { install: (filePath: string) => Promise<void> };
};

export async function installApk(filePath: string): Promise<void> {
  if (!ApkInstaller?.install) {
    throw new Error('ApkInstaller native module not available');
  }
  return ApkInstaller.install(filePath);
}
