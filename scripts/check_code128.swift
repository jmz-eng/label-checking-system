import Foundation
import Vision

guard CommandLine.arguments.count == 3 else {
    fputs("Usage: check-code128 image.png expected-12-digit-code\n", stderr)
    exit(2)
}
let request = VNDetectBarcodesRequest()
request.symbologies = [.code128]
do {
    try VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1]), options: [:]).perform([request])
    let decoded = (request.results ?? []).compactMap { $0.payloadStringValue }
    guard decoded == [CommandLine.arguments[2]] else {
        fputs("FAIL: CODE128 expected exact identity; decoded \(decoded)\n", stderr)
        exit(1)
    }
    print("PASS CODE128: \(decoded[0])")
} catch {
    fputs("FAIL: \(error)\n", stderr)
    exit(1)
}
