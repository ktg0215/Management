declare module 'encoding-japanese' {
  type EncodingType = 'UTF8' | 'UTF16' | 'UTF16BE' | 'UTF16LE' | 'SJIS' | 'EUCJP' | 'JIS' | 'UNICODE' | 'ASCII' | 'BINARY' | 'AUTO';

  interface ConvertOptions {
    to: EncodingType;
    from?: EncodingType | string;
    type?: 'string' | 'array';
    bom?: boolean;
  }

  interface Encoding {
    detect(data: Uint8Array | number[] | string): EncodingType | false;
    convert(data: Uint8Array | number[] | string, options: ConvertOptions): number[];
    codeToString(code: number[]): string;
    stringToCode(string: string): number[];
    urlEncode(data: number[]): string;
    urlDecode(string: string): number[];
    base64Encode(data: number[]): string;
    base64Decode(string: string): number[];
  }

  const Encoding: Encoding;
  export default Encoding;
  export = Encoding;
}
